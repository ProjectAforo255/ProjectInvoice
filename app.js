require('dotenv').config()
const express = require('express')
const app = express()

const { ZIPKIN_LOCAL_ENDPOINT, ZIPKIN_SERVICE_NAME } = require('./app/common/constants')

const NacosConfigClient = require('nacos').NacosConfigClient;

async function startServer() {
    const configClient = new NacosConfigClient({
        serverAddr: process.env.NACOS_SERVERADDR,
        serverPort: process.env.NACOS_PORT,
        namespace: process.env.NACOS_NAMESPACE
      });
      
    // listen data changed
    let config = await configClient.getConfig( process.env.NACOS_DATAID, process.env.NACOS_GROUP)
        .then(content => {
            let config = JSON.parse(content);
            for (const key in config) {
                process.env[key.toUpperCase()] = config[key];
            }
            return config;
        }).catch((err)=>{
            console.log('Error con nacos');
            console.log(err);
        })
          
      
    const PORT = process.env.SERVER_PORT_ACCOUNT || 3002;

    const { Tracer, ExplicitContext, BatchRecorder, jsonEncoder } = require('zipkin')
    const { HttpLogger } = require('zipkin-transport-http')
    const zipkinMiddleware = require('zipkin-instrumentation-express').expressMiddleware
    const ZIPKIN_ENDPOINT = process.env.ZIPKIN_ENDPOINT || ZIPKIN_LOCAL_ENDPOINT
    const tracer = new Tracer({
        ctxImpl: new ExplicitContext(),
        recorder: new BatchRecorder({
            logger: new HttpLogger({
                endpoint: `${ZIPKIN_ENDPOINT}/api/v2/spans`,
                jsonEncoder: jsonEncoder.JSON_V2,
            }),
        }),
        localServiceName: ZIPKIN_SERVICE_NAME,
    })
    app.use(zipkinMiddleware({ tracer }))
    
    app.use(express.json())
    app.use('/api', require('./app/routes'))

    init_kafka_consumer();
    
    app.listen(PORT, () => {
        console.log('Application running on port ', PORT)
    })
}

async function init_kafka_consumer(){
    const kafka = new Kafka({
        clientId: 'pay-client',
        brokers: [process.env.KAFKA_SERVER],
    });

    const pool = new Pool({
        user: process.env.DB_POSTGRES_USER,
        password: process.env.DB_POSTGRES_PASSWORD,
        database: process.env.DB_POSTGRES_DATABASE_ACCOUNT,
        host: process.env.DB_POSTGRES_HOST,
        port: process.env.DB_POSTGRES_PORT,
        ssl: { 
            rejectUnauthorized: !Boolean(process.env.DB_POSTGRES_REJECTUNAUTHORIZED),
        },
        dialect: process.env.DB_POSTGRES_DIALECT,
    });

    console.log('Iniciando kafka_consumer...');

    const consumer = kafka.consumer({groupId: 'pay-subcription', allowAutoTopicCreation: true});
    await consumer.connect();
    await consumer.subscribe({topic: 'pay-topic', fromBeginning: true });
    await consumer.run({
        autoCommit: false,
        eachMessage: async ({topic, partition, message})=>{
            console.log({ value: message.value.toString() })

            var jsonObj = JSON.parse(message.value.toString())
            var amountNew = 0;
            if( jsonObj.type === 'pay' ){
                amountNew = jsonObj.amount * (-1)
            }else{
                amountNew = jsonObj.amount;
            }

            pool.query('UPDATE account SET amount = amount + $1 WHERE id= $2',[amountNew, jsonObj.accountId], async (err, result)=>{
                if( err ){
                    return console.log('Error executing query', err.stack)
                }
                console.log('Account modifield with accountId: ', jsonObj.accountId)
                await consumer.commitOffsets([{topic, partition, offset: ( Number(message.offset)+1).toString() }])
            })
        }
    })
}

startServer()


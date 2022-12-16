require('dotenv').config()
const express = require('express')
const app = express()
const { Kafka } = require('kafkajs')
const { Pool } = require('pg')

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

            serRoutesAndListener()
            return config;
        }).catch((err)=>{
            console.log('Error con nacos');
            console.log(err);
        })
          
    init_kafka_consumer();
    
}

function serRoutesAndListener(){
    const PORT = process.env.SERVER_PORT_ACCOUNT || 3002;
    
    app.use(express.json())
    app.use('/api', require('./app/routes'))
    
    app.listen(PORT, () => {
        console.log('Application running on port ', PORT)
    })
}

async function init_kafka_consumer(){

    const logProvider = require('./app/middleware/logprovider')

    try {
        logProvider.info('Iniciando kafka-invoice');
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
    
        const consumer = kafka.consumer({groupId: 'pay-subcription', allowAutoTopicCreation: true});
        await consumer.connect();
        await consumer.subscribe({topic: 'pay-topic', fromBeginning: true });
        await consumer.run({
            autoCommit: false,
            eachMessage: async ({topic, partition, message})=>{
    
                var jsonObj = JSON.parse(message.value.toString())
                var amountNew = 0;
                if( jsonObj.type === 'pay' ){
                    amountNew = jsonObj.amount * (-1)
                }else{
                    amountNew = jsonObj.amount;
                }
    
                pool.query('UPDATE account SET amount = amount + $1 WHERE id= $2',[amountNew, jsonObj.accountId], async (err, result)=>{
                    if( err ){
                        logProvider.info('Error executing query', err.stack)
                        return;
                    }
                    logProvider.info('Account modifield with accountId: ', jsonObj.accountId)
                    await consumer.commitOffsets([{topic, partition, offset: ( Number(message.offset)+1).toString() }])
                })
            }
        })
        
    } catch (error) {
        console.log('Error kafka');
        console.log(error);
        
    }

}

startServer()


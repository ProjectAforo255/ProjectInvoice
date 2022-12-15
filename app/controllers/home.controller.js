const home = async (req, res) => {
    return res.send({message: "Hello Home"});
}

module.exports = { home }
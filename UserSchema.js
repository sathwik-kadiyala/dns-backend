const mongoose = require('mongoose');

mongoose.set('strictQuery', true);

const userSchema = new mongoose.Schema({
    email: String,
    password: String
});

module.exports = mongoose.model("users", userSchema);



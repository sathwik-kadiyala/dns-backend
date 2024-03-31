const mongoose= require('mongoose');
mongoose.connect("mongodb+srv://sathwikkadiyala:pCo7vCNr3B6JVAPs@cluster0.s3imjyz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
  .then(() => {
    console.log("Connected to MongoDB Atlas");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB Atlas:", error);
  });


  
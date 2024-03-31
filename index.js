const express = require("express");
const cors = require("cors");
const AWS = require('aws-sdk'); 
require("./Config.js");
const User = require('./UserSchema.js');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());
  

// Set AWS credentials
const credentials = new AWS.Credentials({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
AWS.config.credentials = credentials;

// Create Route 53 object
const route53 = new AWS.Route53();

app.post("/check-email", async (req, resp) => {
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
        return resp.json({ exists: true });
    } else {
        return resp.json({ exists: false });
    }
});

app.post("/register", async (req, resp) => {
    let user = new User(req.body);
    let result = await user.save();
    result = result.toObject();
    delete result.password
    resp.send(result)
});

app.post("/login", async (req, resp) => {
    let user = await User.findOne(req.body).select("-password");
    if (user) {
        resp.send(user)
    } else {
        resp.status(400).send({ result: "No User found" })
    }
});

app.post("/add-dns-record", async (req, resp) => {
    const { name, type, ttl, value } = req.body;

    // Construct the ChangeBatch parameters
    const params = {
        ChangeBatch: {
            Changes: [
                {
                    Action: 'CREATE',
                    ResourceRecordSet: {
                        Name: name,
                        Type: type,
                        TTL: ttl,
                        ResourceRecords: value 
                    }
                }
            ],
            Comment: 'Add record'
        },
        HostedZoneId: process.env.HOSTED_ZONE_ID 
    };

    route53.changeResourceRecordSets(params, function(err, data) {
        if (err) {
            console.log(err);
            resp.status(500).send({ error: 'Failed to add DNS record' });
        } else {
            console.log(data);
            resp.send({ success: true });
        }
    });
});

app.get("/get-dns-records", async (req, res) => {
    const params = {
        HostedZoneId: process.env.HOSTED_ZONE_ID    };

    route53.listResourceRecordSets(params, function(err, data) {
        if (err) {
            console.log(err);
            res.status(500).send({ error: 'Failed to fetch DNS records' });
        } else {
            // console.log(data);
            res.send(data.ResourceRecordSets);
        }
    });
});
// Update Route
app.put("/update-dns-record/:id", async (req, res) => {
    const { id } = req.params;
    const updatedRecord = req.body;

    // Ensure that updatedRecord.value is an array
    if (!Array.isArray(updatedRecord.value)) {
        return res.status(400).json({ error: 'Value must be an array' });
    }

    const params = {
        HostedZoneId: process.env.HOSTED_ZONE_ID, // Replace with your hosted zone ID
        ChangeBatch: {
            Changes: [
                {
                    Action: 'UPSERT',
                    ResourceRecordSet: {
                        Name: updatedRecord.name,
                        Type: updatedRecord.type,
                        TTL: updatedRecord.ttl,
                        ResourceRecords: updatedRecord.value.map(val => ({ Value: val }))
                    }
                }
            ]
        }
    };

    route53.changeResourceRecordSets(params, function(err, data) {
        if (err) {
            console.error('Error updating record:', err);
            res.status(500).json({ error: 'Failed to update record' });
        } else {
            console.log('Record updated successfully:', data);
            res.json({ success: true });
        }
    });
});

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});


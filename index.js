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

app.post("/add-hosted-zone", async (req, res) => {
    const { name, description, type } = req.body;

    
    const params = {
        CallerReference: Date.now().toString(),
        Name: name,
        HostedZoneConfig: {
            Comment: description,
            PrivateZone: type === 'private'
        }
    };

    
    route53.createHostedZone(params, function(err, data) {
        if (err) {
            console.error('Error creating hosted zone:', err);
            res.status(500).json({ error: 'Failed to create hosted zone' });
        } else {
            const hostedZoneId = data.HostedZone.Id;
        
            res.json({ success: true, hostedZoneId });
        }
    });
});

app.delete("/delete-hosted-zone/:hostedZoneId", async (req, res) => {
    const { hostedZoneId } = req.params;

    // Use the hostedZoneId to delete the corresponding hosted zone
    const params = {
        Id: hostedZoneId
    };

    route53.deleteHostedZone(params, function(err, data) {
        if (err) {
            console.error('Error deleting hosted zone:', err);
            res.status(500).json({ error: 'Failed to delete hosted zone' });
        } else {
            console.log('Hosted zone deleted successfully');
            res.json({ success: true });
        }
    });
});
app.post("/add-dns-record", async (req, resp) => {
    const { name, type, ttl, value, hostedZoneId } = req.body;

    // Construct the ChangeBatch parameters
    console.log(value)
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
        HostedZoneId: hostedZoneId 
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

app.get('/get-domains', async (req, res) => {
    try {
        const params = {
            MaxItems: '100' 
        };

        const data = await route53.listHostedZones(params).promise();

       
        const domains = data.HostedZones.map(zone => ({
            name: zone.Name.replace(/\.$/, ''),
            hostedZoneId: zone.Id.split('/')[2] 
        }));

        res.json({ domains });
    } catch (error) {
        console.error('Error fetching domains:', error);
        res.status(500).json({ error: 'Failed to fetch domains' });
    }
});


app.get("/get-dns-records", async (req, res) => {
    const { hostedZoneId } = req.query;

    const params = {
        HostedZoneId: hostedZoneId
    };

    route53.listResourceRecordSets(params, function(err, data) {
        if (err) {
            console.error(err);
            res.status(500).send({ error: 'Failed to fetch DNS records' });
        } else {
            res.send(data.ResourceRecordSets);
        }
    });
});


// Update Route
app.put("/update-dns-record/", async (req, res) => {
    // const { id } = req.params;
    const updatedRecord = req.body;
    const hostedZoneId=updatedRecord.hostedZoneId;
    if (!Array.isArray(updatedRecord.value)) {
        return res.status(400).json({ error: 'Value must be an array' });
    }

    const params = {
        HostedZoneId: hostedZoneId, 
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


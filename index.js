require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');

const app = express();
const port = 3000;

app.use(bodyParser.json({ limit: '50mb' }));

const whitelist = ['http://localhost:5173', process.env.APP_URL];
const corsOptions = {
    origin(origin, callback) {
        if (whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
};
app.use(cors(corsOptions));

app.use(helmet());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/image', async (req, res) => {
    const response = await axios.get(
        `https://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image?max_results=500`
    );

    const responseArray = response.data.resources
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .map((item) => item.secure_url);

    res.send(responseArray);
});

app.post('/image', async (req, res) => {
    const response = await axios.post(
        `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
            file: req.body.file,
            upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
            public_id: req.body.public_id,
            tags: req.body.tags,
        }
    );
    res.json({ url: response.data.url });
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

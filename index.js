require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const fetch = require('node-fetch');
const JSZip = require('jszip');

const app = express();
const port = process.env.PORT;

app.use(bodyParser.json({ limit: '50mb' }));

// const whitelist = ['http://localhost:5173', process.env.APP_URL];
// const corsOptions = {
//     origin(origin, callback) {
//         if (whitelist.indexOf(origin) !== -1) {
//             callback(null, true);
//         } else {
//             callback(new Error('Not allowed by CORS'));
//         }
//     },
// };
// app.use(cors(corsOptions));

app.use(cors());

app.use(helmet());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/image', async (req, res) => {
    try {
        const response = await axios.get(
            `https://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image?max_results=500`
        );

        const responseArray = response.data.resources
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            .map((item) => item.secure_url);

        res.json(responseArray);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Can not get images',
        });
    }
});

app.post('/image', async (req, res) => {
    try {
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
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Can not upload image',
        });
    }
});

app.get('/download-images', async (req, res) => {
    try {
        const response = await axios.get(
            `https://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image?max_results=500`
        );

        const imagesToDownload = response.data.resources.sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );

        const zip = new JSZip();

        // Fetch each image source
        const request = async () => {
            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < imagesToDownload.length; i++) {
                const image = imagesToDownload[i];
                // eslint-disable-next-line no-await-in-loop
                const imageResponse = await fetch(image.url);
                // eslint-disable-next-line no-await-in-loop
                const buffer = await imageResponse.buffer();
                const filename = `${image.public_id.substring(
                    image.public_id.lastIndexOf('/') + 1
                )}.${image.format}`;
                zip.file(filename, buffer);
            }
        };

        request().then(() => {
            // Set the name of the zip file in the download
            res.setHeader(
                'Content-Disposition',
                'attachment; filename="sketchair-images.zip"'
            );

            // Send the zip file
            zip.generateNodeStream({ type: 'nodebuffer', streamFiles: true })
                .pipe(res)
                .on('finish', () => {
                    console.log('sketchair-images.zip written.');
                });
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Can not download images',
        });
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

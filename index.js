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
            `https://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image?max_results=500&context=true`
        );

        const imageArray = [];
        let sketchArray = [];
        // eslint-disable-next-line no-plusplus
        for (let i = 0; i < response.data.resources.length; i++) {
            const element = response.data.resources[i];
            if (element.public_id.endsWith('image')) {
                imageArray.push(element);
            } else if (element.public_id.endsWith('sketch')) {
                if (
                    !element.public_id.endsWith(
                        'pink_slimy_nature_asd_asd_sketch'
                    ) &&
                    !element.public_id.endsWith(
                        'cyan_liquid_fantasy_test_test_sketch'
                    ) &&
                    !element.public_id.endsWith(
                        'orange_liquid_reptile_test_new_sketch'
                    )
                ) {
                    sketchArray.push(element);
                }
            }
        }

        sketchArray = sketchArray.sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
        );

        let responseArray = [];
        // eslint-disable-next-line no-plusplus
        for (let i = 0; i < sketchArray.length; i++) {
            const sketchElement = sketchArray[i];
            const sketchString = sketchElement.public_id.substring(
                0,
                sketchElement.public_id.lastIndexOf('_')
            );
            // eslint-disable-next-line no-plusplus
            for (let j = 0; j < imageArray.length; j++) {
                const imageElement = imageArray[j];
                const imageString = imageElement.public_id.substring(
                    0,
                    imageElement.public_id.lastIndexOf('_')
                );
                if (sketchString === imageString) {
                    responseArray.push(sketchElement);
                    responseArray.push(imageElement);
                    break;
                }
            }
        }

        responseArray = responseArray.map((item) => ({
            url: item.secure_url,
            description: item.context ? item.context.custom.description : '',
        }));

        responseArray = responseArray.slice(responseArray.length - 118);

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
                context: `description=${req.body.description}`,
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

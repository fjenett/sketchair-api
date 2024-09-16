const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const JSZip = require('jszip'); // Added JSZip import

// Load environment variables from .env file
dotenv.config();

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    try {
        let images = [];
        let nextCursor = null;
        let skippedAssets = [];

        // Fetch the list of all available images from Cloudinary, handling pagination with next_cursor
        do {
            const response = await axios.get(
                `https://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image`, 
                {
                    params: {
                        max_results: 500,
                        next_cursor: nextCursor
                    }
                }
            );

            images = images.concat(response.data.resources);
            nextCursor = response.data.next_cursor;

            // Provide feedback on progress
            console.log(`Fetched ${images.length} images so far...`);

            // Delay to stay well below the API rate limit
            await delay(8000); // 8 seconds delay
        } while (nextCursor);

        // Log the total number of resources found
        console.log(`Total resources found: ${images.length}`);

        // Create a zip file with the current date/time in a subfolder called backups
        const zip = new JSZip();
        const backupFolder = zip.folder('backups');
        const dateTime = new Date().toISOString().replace(/[:.]/g, '-');
        const zipFilename = `backup-${dateTime}.zip`;

        // Store the list of files as JSON into the zip
        const imageListJson = JSON.stringify(images, null, 2);
        backupFolder.file('imageList.json', imageListJson);

        // Download each image, fetch its details, and add both to the zip file
        for (const [index, image] of images.entries()) {
            try {
                const imageResponse = await axios.get(image.secure_url, { responseType: 'arraybuffer' });
                const imageName = path.basename(image.secure_url);
                backupFolder.file(imageName, imageResponse.data);

                // Fetch image details using the Admin API
                const imageDetailsResponse = await axios.get(
                    `https://${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}@api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/${image.asset_id}`
                );
                const imageDetailsJson = JSON.stringify(imageDetailsResponse.data, null, 2);
                backupFolder.file(`${imageName}.json`, imageDetailsJson);

                // Provide feedback on progress
                console.log(`Processed ${index + 1} of ${images.length} images...`);

                // Delay to stay well below the API rate limit
                await delay(8000); // 8 seconds delay
            } catch (error) {
                console.error(`Error processing image with ID ${image.asset_id}:`, error);
                skippedAssets.push(image.asset_id);
            }
        }

        // Store the list of skipped assets as JSON into the zip
        const skippedAssetsJson = JSON.stringify(skippedAssets, null, 2);
        backupFolder.file('skippedAssets.json', skippedAssetsJson);

        // Generate the zip file and save it to the filesystem
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        const outputPath = path.join(__dirname, zipFilename);
        fs.writeFileSync(outputPath, zipContent);

        console.log(`Backup completed: ${outputPath}`);
    } catch (error) {
        console.error('Error during backup process:', error);
    }
})();

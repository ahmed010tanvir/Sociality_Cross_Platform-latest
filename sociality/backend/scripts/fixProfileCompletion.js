import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/userModel.js';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function fixProfileCompletion() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find users who have name and username but isProfileComplete is false or undefined
        const usersToUpdate = await User.find({
            $and: [
                { name: { $exists: true, $ne: "" } },
                { username: { $exists: true, $ne: "" } },
                {
                    $or: [
                        { isProfileComplete: false },
                        { isProfileComplete: { $exists: false } }
                    ]
                }
            ]
        });

        console.log(`Found ${usersToUpdate.length} users to update`);

        if (usersToUpdate.length === 0) {
            console.log('No users need updating');
            return;
        }

        // Update all these users to have isProfileComplete: true
        const result = await User.updateMany(
            {
                $and: [
                    { name: { $exists: true, $ne: "" } },
                    { username: { $exists: true, $ne: "" } },
                    {
                        $or: [
                            { isProfileComplete: false },
                            { isProfileComplete: { $exists: false } }
                        ]
                    }
                ]
            },
            { $set: { isProfileComplete: true } }
        );

        console.log(`Successfully updated ${result.modifiedCount} users`);
        
        // List the updated users
        usersToUpdate.forEach(user => {
            console.log(`- Updated user: ${user.username} (${user.name})`);
        });

    } catch (error) {
        console.error('Error fixing profile completion:', error);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Run the script
fixProfileCompletion();

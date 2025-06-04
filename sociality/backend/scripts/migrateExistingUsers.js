import mongoose from "mongoose";
import User from "../models/userModel.js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const migrateExistingUsers = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to MongoDB");

        // Find users who have complete profile data but don't have isProfileComplete set
        const usersToUpdate = await User.find({
            name: { $exists: true, $ne: "" },
            username: { $exists: true, $ne: "" },
            email: { $exists: true, $ne: "" },
            $or: [
                { isProfileComplete: { $exists: false } },
                { isProfileComplete: false }
            ]
        });

        console.log(`Found ${usersToUpdate.length} users to update`);

        if (usersToUpdate.length === 0) {
            console.log("No users need migration");
            return;
        }

        // Update users to mark their profiles as complete
        const result = await User.updateMany(
            {
                name: { $exists: true, $ne: "" },
                username: { $exists: true, $ne: "" },
                email: { $exists: true, $ne: "" },
                $or: [
                    { isProfileComplete: { $exists: false } },
                    { isProfileComplete: false }
                ]
            },
            {
                $set: { isProfileComplete: true }
            }
        );

        console.log(`Successfully updated ${result.modifiedCount} users`);
        console.log("Migration completed successfully");

        // List updated users
        console.log("\nUpdated users:");
        usersToUpdate.forEach(user => {
            console.log(`- ${user.name} (${user.username}) - ${user.email}`);
        });

    } catch (error) {
        console.error("Migration failed:", error);
    } finally {
        // Close the connection
        await mongoose.connection.close();
        console.log("Database connection closed");
    }
};

// Run the migration
migrateExistingUsers();

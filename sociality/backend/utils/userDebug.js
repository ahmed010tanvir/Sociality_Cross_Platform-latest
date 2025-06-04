import User from '../models/userModel.js';

/**
 * Debug utility to find and analyze user duplicates
 */
export const findDuplicateUsers = async (email) => {
    try {
        console.log(`\n=== DEBUGGING USER DUPLICATES FOR: ${email} ===`);
        
        // Find all users with this email
        const usersByEmail = await User.find({ email: email });
        console.log(`Found ${usersByEmail.length} users with email: ${email}`);
        
        usersByEmail.forEach((user, index) => {
            console.log(`\nUser ${index + 1}:`);
            console.log(`  ID: ${user._id}`);
            console.log(`  Email: ${user.email}`);
            console.log(`  Username: ${user.username}`);
            console.log(`  Name: ${user.name}`);
            console.log(`  GoogleId: ${user.googleId || 'None'}`);
            console.log(`  IsGoogleUser: ${user.isGoogleUser}`);
            console.log(`  IsProfileComplete: ${user.isProfileComplete}`);
            console.log(`  Created: ${user.createdAt}`);
        });
        
        // Find users with Google ID if any
        const googleUsers = usersByEmail.filter(user => user.googleId);
        if (googleUsers.length > 0) {
            console.log(`\nGoogle OAuth users found: ${googleUsers.length}`);
            googleUsers.forEach((user, index) => {
                console.log(`  Google User ${index + 1}: GoogleId=${user.googleId}`);
            });
        }
        
        // Check for potential issues
        if (usersByEmail.length > 1) {
            console.log(`\n⚠️  WARNING: Multiple users found with same email!`);
            console.log(`This could cause authentication issues.`);
        }
        
        return usersByEmail;
    } catch (error) {
        console.error('Error finding duplicate users:', error);
        return [];
    }
};

/**
 * Clean up duplicate users (use with caution!)
 */
export const cleanupDuplicateUsers = async (email) => {
    try {
        const users = await User.find({ email: email }).sort({ createdAt: 1 });
        
        if (users.length <= 1) {
            console.log(`No duplicates found for ${email}`);
            return;
        }
        
        console.log(`\n=== CLEANING UP DUPLICATES FOR: ${email} ===`);
        console.log(`Found ${users.length} users, keeping the first one...`);
        
        const keepUser = users[0];
        const duplicateUsers = users.slice(1);
        
        console.log(`Keeping user: ${keepUser._id} (created: ${keepUser.createdAt})`);
        
        // Merge Google data if any duplicate has it
        for (const duplicate of duplicateUsers) {
            if (duplicate.googleId && !keepUser.googleId) {
                keepUser.googleId = duplicate.googleId;
                keepUser.isGoogleUser = true;
                console.log(`Merged Google ID: ${duplicate.googleId}`);
            }
            
            if (duplicate.profilePic && !keepUser.profilePic) {
                keepUser.profilePic = duplicate.profilePic;
                console.log(`Merged profile picture`);
            }
        }
        
        // Save the merged user
        await keepUser.save();
        
        // Delete duplicates
        for (const duplicate of duplicateUsers) {
            console.log(`Deleting duplicate user: ${duplicate._id}`);
            await User.findByIdAndDelete(duplicate._id);
        }
        
        console.log(`✅ Cleanup completed. Kept user: ${keepUser._id}`);
        return keepUser;
    } catch (error) {
        console.error('Error cleaning up duplicate users:', error);
        throw error;
    }
};

/**
 * Get all users with potential issues
 */
export const findAllDuplicateEmails = async () => {
    try {
        const duplicates = await User.aggregate([
            {
                $group: {
                    _id: "$email",
                    count: { $sum: 1 },
                    users: { $push: { id: "$_id", username: "$username", googleId: "$googleId" } }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);
        
        console.log(`\n=== ALL DUPLICATE EMAILS ===`);
        console.log(`Found ${duplicates.length} emails with duplicates:`);
        
        duplicates.forEach(duplicate => {
            console.log(`\nEmail: ${duplicate._id}`);
            console.log(`Count: ${duplicate.count}`);
            duplicate.users.forEach((user, index) => {
                console.log(`  User ${index + 1}: ${user.id} (${user.username}) GoogleId: ${user.googleId || 'None'}`);
            });
        });
        
        return duplicates;
    } catch (error) {
        console.error('Error finding all duplicates:', error);
        return [];
    }
};

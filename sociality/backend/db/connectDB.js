import mongoose from "mongoose";
import logger from "../utils/logger.js";

const connectDB = async () => {
	try {
		// useNewUrlParser and useUnifiedTopology are deprecated and default to true in Mongoose 6+
		const conn = await mongoose.connect(process.env.MONGO_URI);

		logger.info(`MongoDB Connected: ${conn.connection.host}`);
	} catch (error) {
		logger.error(`Database connection error: ${error.message}`, error);
		process.exit(1);
	}
};

export default connectDB;

import cron from "cron";
import https from "https";
import logger from "../utils/logger.js";

const URL = "https://sociality-backend-production.up.railway.app";

const job = new cron.CronJob("*/14 * * * *", function () {
	https
		.get(URL, (res) => {
			if (res.statusCode === 200) {
				logger.debug("Cron job: GET request sent successfully");
			} else {
				logger.info(`Cron job: GET request failed with status code ${res.statusCode}`);
			}
		})
		.on("error", (e) => {
			logger.error("Cron job: Error while sending request", e);
		});
});

export default job;



// Logger utility to control logging throughout the application

// Log levels: 0 = none, 1 = error only, 2 = error + info, 3 = error + info + debug
const LOG_LEVELS = {
    NONE: 0,
    ERROR: 1,
    INFO: 2,
    DEBUG: 3
};

// Get log level from environment variable or default to INFO in development and ERROR in production
const getLogLevel = () => {
    const envLogLevel = process.env.LOG_LEVEL;
    if (envLogLevel && LOG_LEVELS[envLogLevel.toUpperCase()] !== undefined) {
        return LOG_LEVELS[envLogLevel.toUpperCase()];
    }
    return process.env.NODE_ENV === 'development' ? LOG_LEVELS.INFO : LOG_LEVELS.ERROR;
};

// Current log level
const currentLogLevel = getLogLevel();

// Socket-specific logging can be disabled separately
const enableSocketLogs = process.env.ENABLE_SOCKET_LOGS === 'true';

const logger = {
    // For important information
    info: (message, data) => {
        if (currentLogLevel >= LOG_LEVELS.INFO) {
            console.log(`[INFO] ${message}`, data ? data : '');
        }
    },

    // For errors that should always be logged
    error: (message, error) => {
        if (currentLogLevel >= LOG_LEVELS.ERROR) {
            console.error(`[ERROR] ${message}`, error ? error : '');
        }
    },

    // For debug information
    debug: (message, data) => {
        if (currentLogLevel >= LOG_LEVELS.DEBUG) {
            console.log(`[DEBUG] ${message}`, data ? data : '');
        }
    },

    // For warnings
    warn: (message, data) => {
        if (currentLogLevel >= LOG_LEVELS.INFO) {
            console.warn(`[WARN] ${message}`, data ? data : '');
        }
    },

    // For socket-related logs
    socket: (message, data) => {
        if (enableSocketLogs && currentLogLevel >= LOG_LEVELS.INFO) {
            console.log(`[SOCKET] ${message}`, data ? data : '');
        }
    }
};

export default logger;

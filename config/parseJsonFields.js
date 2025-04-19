// Example middleware (place in a suitable file, e.g., middleware/parseJsonFields.js)
const parseJsonFields = (fieldsToParse) => {
    return (req, res, next) => {
        const logger = req.log || console; // Use request logger if available (pino-http)
        try {
            if (req.body) { // Ensure body exists
                fieldsToParse.forEach(field => {
                    if (req.body[field] && typeof req.body[field] === 'string') {
                        logger.info(`Parsing field: ${field}`);
                        req.body[field] = JSON.parse(req.body[field]);
                    }
                });
            }
            next(); // Proceed to the next middleware (validation)
        } catch (error) {
            // Handle JSON parsing errors (e.g., malformed JSON string)
            logger.error({ error, body: req.body }, "Error parsing JSON fields from form data");
            // Send a specific error response - don't proceed
            // Check if headers already sent before sending response
            if (!res.headersSent) {
                // Mimic SSE error format if possible, otherwise standard JSON
                const isSse = req.headers.accept === 'text/event-stream';
                const statusCode = 400;
                const errorResponse = {
                    status: "error",
                    statusCode: statusCode,
                    message: `Invalid JSON format in form data field. ${error.message}`,
                    // Avoid sending detailed stack in production
                    error: process.env.NODE_ENV === 'development' ? { message: error.message, stack: error.stack } : { message: error.message },
                };

                if (isSse) {
                    res.writeHead(statusCode, { 'Content-Type': 'text/event-stream' });
                    res.write(`data: ${JSON.stringify(errorResponse)}\n\n`);
                    res.end();
                } else {
                    res.status(statusCode).json(errorResponse);
                }
            } else {
                // If headers are sent (e.g., SSE already started), maybe just end the stream or log
                logger.warn("Headers already sent, cannot send JSON parsing error response.");
                if (res.end) res.end(); // Attempt to close the connection if possible
            }
        }
    };
};

module.exports = parseJsonFields;
const swaggerJsdoc = require('swagger-jsdoc');
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Conversation API',
            version: '1.0.0',
            description: 'API documentation for the Conversation Service',
        },
        servers: [
            {
                url: `http://localhost:${process.env.PORT || 6500}`,
                description: 'Development server',
            },
        ],
    },
    apis: ['./routes/*.js'], // Path to the API routes
};

const specs = swaggerJsdoc(options);
module.exports = specs; 
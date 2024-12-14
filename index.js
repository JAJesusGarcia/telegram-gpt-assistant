import dotenv from 'dotenv';

dotenv.config();

// MongoDB connection
const connectToDatabase = async () = {
//
}

// OpenAI configuration
const openaiConfig = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(openaiConfig);

// Set initial user state
const setUser = () => ({
    userId: null,
    conversation: [],
    state: 'initial',
});
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import Conversation from './models/Conversation';
import mongoose from 'mongoose';

dotenv.config();

// MongoDB connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

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

// Process user input with OpenAI
const getResponseFromChatGPT = async (text) => {
    try {
        const response = await openai.createCompletion({
            model: 'text-davinci-003',
            prompt: text,
            max_tokens: 150,
        });
        return response.data.choise[0].text.trim();
    } catch (error) {
        console.error('Error with OpenAI:', error);
        return 'I had trouble processing that. Please try again.'
    }
};

// Save conversartion to MongoDB
const saveConversation = async () = {
    //
}

// Telegram Bot setup
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true});

const handleUserMessage = async () => {
    //
}

// Get a response from ChatGPT
const gptReply = await getResponseFromChatGPT(message);

// Main bot logic
const motherJob = async () => {
    //
}
import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import Conversation from './models/Conversation.js';
import mongoose from 'mongoose';
import { Configuration, OpenAIApi } from 'openai';

dotenv.config();

// MongoDB connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
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
    return 'I had trouble processing that. Please try again.';
  }
};

// Save conversartion to MongoDB
const saveConversation = async (userId, messages) => {
  try {
    const existingConversation = await Conversation.findOne({ userId });
    if (existingConversation) {
      existingConversation.messages.push(...messages);
      await existingConversation.save();
    } else {
      const newConversation = new Conversation({ userId, messages });
      await newConversation.save();
    }
    console.log('Conversation saved');
  } catch (error) {
    console.error('Error saving conversation:', error);
  }
};

// Telegram Bot setup
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

const handleUserMessage = async (User, message) => {
  User.Conversation.push({ sender: 'user', text: message });

  let reply = '';
  switch (User.state) {
    case 'initial':
      reply = 'Hi! Are you looking for a health insurance plan? (Yes/No)';
      User.state = 'askingHealthInsurance';
      break;

    case 'askingHealthInsurance':
      if (message.toLowerCase() === 'yes') {
        reply = 'Great! What is your family size?';
        User.state = 'askingFamilySize';
      } else {
        reply =
          'Alright. Let me know if you need assistance with anything else!';
        User.state = 'initial';
      }
      break;

    case 'asikingFamilySize':
      reply = 'What is your household income?';
      User.state = 'askingIncome';
      break;

    case 'askingIcome':
      reply = 'What is your gender?';
      User.state = 'askinGender';
      break;

    case 'askinGender':
      reply =
        'Thank you for the information! If you have any more questions, feel to ask.';
      User.state = 'initial';
      break;
  }

  // Get a response from ChatGPT
  const gptReply = await getResponseFromChatGPT(message);
  if (gptReply) {
    reply += `\n\nChatGPT says: ${gptReply}`;
  }

  User.Conversation.push({ sender: 'bot', text: reply });
  return reply;
};

// Main bot logic
const motherJob = async () => {
  try {
    await connectToDatabase();

    const User = setUser();

    bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      User.userId = chatId;

      const reply = await handleUserMessage(User, msg.text);

      await saveConversation(chatId, User.conversation);

      bot.sendMessage(chatId, reply);
    });
  } catch (error) {
    console.error('Error in motherJob:', error);
  }
};

motherJob();

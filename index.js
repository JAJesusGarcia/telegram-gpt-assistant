import dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import mongoose from 'mongoose';
import OpenAI from 'openai';
import Conversation from './models/Conversation.js';
import {
  isValidFamilySize,
  isValidIncome,
  isValidGender,
  getErrorMessage,
} from './validators.js';

dotenv.config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = `${process.env.WEBHOOK_BASE_URL}/bot${TOKEN}`;

const app = express();
app.use(express.json());

const bot = new TelegramBot(TOKEN, { webHook: true });

bot.setWebHook(WEBHOOK_URL).then(() => {
  console.log(`Webhook configurado correctamente en ${WEBHOOK_URL}`);
});

app.post(`/bot${TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

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

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper functions
const setUser = () => ({
  userId: null,
  conversation: [],
  state: 'initial',
});

const getResponseFromChatGPT = async (text) => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: text }],
      max_tokens: 150,
      temperature: 0.7,
    });

    return response?.choices[0]?.message?.content?.trim() || 'No response.';
  } catch (error) {
    console.error('Error with OpenAI:', error);
    return 'Sorry, I couldn’t process that.';
  }
};

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

const handleUserMessage = async (User, message) => {
  User.conversation.push({ sender: 'user', text: message });

  let reply = '';
  let validResponse = true;

  switch (User.state) {
    case 'initial':
      reply = 'Hi! Are you looking for a health insurance plan? (Yes/No)';
      User.state = 'askingHealthInsurance';
      break;

    case 'askingHealthInsurance':
      if (message.toLowerCase() === 'yes') {
        reply = 'Great! What is your family size?';
        User.state = 'askingFamilySize';
      } else if (message.toLowerCase() === 'no') {
        reply =
          'Alright. Let me know if you need assistance with anything else!';
        User.state = 'initial';
      } else {
        validResponse = false;
        reply = 'Please respond with "Yes" or "No".';
      }
      break;

    case 'askingFamilySize':
      if (isValidFamilySize(message)) {
        reply = 'What is your household income?';
        User.state = 'askingIncome';
      } else {
        validResponse = false;
        reply = getErrorMessage(User.state);
      }
      break;

    case 'askingIncome':
      if (isValidIncome(message)) {
        reply = 'What is your gender?';
        User.state = 'askingGender';
      } else {
        validResponse = false;
        reply = getErrorMessage(User.state);
      }
      break;

    case 'askingGender':
      if (isValidGender(message)) {
        reply =
          'Thank you for the information! If you have any more questions, feel free to ask.';
        User.state = 'initial';
      } else {
        validResponse = false;
        reply = getErrorMessage(User.state);
      }
      break;

    default:
      reply = 'I didn’t quite get that. Could you try again?';
  }

  if (validResponse) {
    const gptReply = await getResponseFromChatGPT(message);
    if (gptReply) {
      reply += `\n\nChatGPT says: ${gptReply}`;
    }
  }

  User.conversation.push({ sender: 'bot', text: reply });
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

      if (User.state === 'initial') {
        const initialReply = await handleUserMessage(User, '');
        bot.sendMessage(chatId, initialReply);
        return;
      }

      const reply = await handleUserMessage(User, msg.text);

      await saveConversation(chatId, User.conversation);

      bot.sendMessage(chatId, reply);
    });
  } catch (error) {
    console.error('Error in motherJob:', error);
  }
};

motherJob();

// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor Express ejecutándose en el puerto ${PORT}`);
});

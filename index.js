import OpenAI from 'openai';
import express from 'express';
import bodyParser from 'body-parser';
import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

import Conversation from './models/Conversation.js';
import {
  isValidFamilySize,
  isValidIncome,
  isValidGender,
  getErrorMessage,
} from './validators.js';

dotenv.config();

const app = express();
app.use(bodyParser.json());

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Set up MongoDB database connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// User conversation state
const userState = {};

// Main bot logic
bot.start((ctx) => {
  ctx.reply('Are you looking for a health insurance plan?');
  userState[ctx.from.id] = { state: 'askingHealthInsurance' };
});

bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const userMessage = ctx.message.text;
  const state = userState[userId]?.state;

  if (!state) {
    ctx.reply('Please type /start to begin.');
    return;
  }

  // Handle the health insurance question
  if (state === 'askingHealthInsurance') {
    userState[userId].state = 'askingFamilySize';
    ctx.reply('How many people are in your family?');
  }
  // Handle the family size question
  else if (state === 'askingFamilySize') {
    if (isValidFamilySize(userMessage)) {
      userState[userId] = { state: 'askingIncome', familySize: userMessage };
      ctx.reply('What is your household income?');
    } else {
      ctx.reply(getErrorMessage(state));
    }
  }
  // Handle the income question
  else if (state === 'askingIncome') {
    if (isValidIncome(userMessage)) {
      userState[userId].income = userMessage;
      userState[userId].state = 'askingGender';
      ctx.reply('What is your gender? (male, female, other)');
    } else {
      ctx.reply(getErrorMessage(state));
    }
  }
  // Handle the gender question
  else if (state === 'askingGender') {
    if (isValidGender(userMessage)) {
      userState[userId].gender = userMessage;
      ctx.reply('Thank you! Let me process your data...');

      try {
        // Generate a response using OpenAI
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant.',
            },
            {
              role: 'user',
              content: `Health Insurance: ${userState[userId].healthInsurance}, Family size: ${userState[userId].familySize}, Income: ${userState[userId].income}, Gender: ${userState[userId].gender}`,
            },
          ],
        });

        const botResponse =
          completion.choices[0]?.message?.content || 'Something went wrong.';
        ctx.reply(botResponse);

        // Save the conversation to MongoDB
        await Conversation.create({
          userId: userId,
          messages: [
            { sender: 'user', text: userMessage },
            { sender: 'bot', text: botResponse },
          ],
        });

        delete userState[userId]; // Reset user state
      } catch (error) {
        console.error('Error with OpenAI:', error);
        ctx.reply('Oops! Something went wrong while processing your data.');
      }
    } else {
      ctx.reply(getErrorMessage(state));
    }
  }
});

// Start the Telegram webhook
const WEBHOOK_URL = `${process.env.WEBHOOK_BASE_URL}/webhook`;

app.use(bot.webhookCallback('/webhook'));

app.listen(3000, () => {
  bot.telegram.setWebhook(WEBHOOK_URL);
  console.log('Server running on port 3000');
});

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

// Configura OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configura la base de datos MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Estado de la conversación
const userState = {};

// Lógica principal del bot
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

  if (state === 'askingHealthInsurance') {
    // Aquí puedes validar si es necesario continuar dependiendo de la respuesta
    // por ejemplo, si la respuesta es afirmativa, puedes continuar con las siguientes preguntas
    userState[userId].state = 'askingFamilySize'; // Cambia al siguiente estado
    ctx.reply('How many people are in your family?');
  } else if (state === 'askingFamilySize') {
    if (isValidFamilySize(userMessage)) {
      userState[userId] = { state: 'askingIncome', familySize: userMessage };
      ctx.reply('What is your household income?');
    } else {
      ctx.reply(getErrorMessage(state));
    }
  } else if (state === 'askingIncome') {
    if (isValidIncome(userMessage)) {
      userState[userId].income = userMessage;
      userState[userId].state = 'askingGender';
      ctx.reply('What is your gender? (male, female, other)');
    } else {
      ctx.reply(getErrorMessage(state));
    }
  } else if (state === 'askingGender') {
    if (isValidGender(userMessage)) {
      userState[userId].gender = userMessage;
      ctx.reply('Thank you! Let me process your data...');

      try {
        // Genera una respuesta de OpenAI
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

        // Guarda la conversación en MongoDB
        await Conversation.create({
          userId: userId,
          messages: [
            { sender: 'user', text: userMessage },
            { sender: 'bot', text: botResponse },
          ],
        });

        delete userState[userId]; // Reinicia el estado del usuario
      } catch (error) {
        console.error('Error with OpenAI:', error);
        ctx.reply('Oops! Something went wrong while processing your data.');
      }
    } else {
      ctx.reply(getErrorMessage(state));
    }
  }
});

// bot.start((ctx) => {
//   ctx.reply('Welcome! Let’s get started. How many people are in your family?');
//   userState[ctx.from.id] = { state: 'askingFamilySize' };
// });

// bot.on('text', async (ctx) => {
//   const userId = ctx.from.id;
//   const userMessage = ctx.message.text;
//   const state = userState[userId]?.state;

//   if (!state) {
//     ctx.reply('Please type /start to begin.');
//     return;
//   }

//   if (state === 'askingFamilySize') {
//     if (isValidFamilySize(userMessage)) {
//       userState[userId] = { state: 'askingIncome', familySize: userMessage };
//       ctx.reply('What is your household income?');
//     } else {
//       ctx.reply(getErrorMessage(state));
//     }
//   } else if (state === 'askingIncome') {
//     if (isValidIncome(userMessage)) {
//       userState[userId].income = userMessage;
//       userState[userId].state = 'askingGender';
//       ctx.reply('What is your gender? (male, female, other)');
//     } else {
//       ctx.reply(getErrorMessage(state));
//     }
//   } else if (state === 'askingGender') {
//     if (isValidGender(userMessage)) {
//       userState[userId].gender = userMessage;
//       ctx.reply('Thank you! Let me process your data...');

//       try {
//         // Genera una respuesta de OpenAI
//         const completion = await openai.chat.completions.create({
//           model: 'gpt-3.5-turbo',
//           messages: [
//             {
//               role: 'system',
//               content: 'You are a helpful assistant.',
//             },
//             {
//               role: 'user',
//               content: `Family size: ${userState[userId].familySize}, Income: ${userState[userId].income}, Gender: ${userState[userId].gender}`,
//             },
//           ],
//         });

//         const botResponse =
//           completion.choices[0]?.message?.content || 'Something went wrong.';
//         ctx.reply(botResponse);

//         // Guarda la conversación en MongoDB
//         await Conversation.create({
//           userId: userId,
//           messages: [
//             { sender: 'user', text: userMessage },
//             { sender: 'bot', text: botResponse },
//           ],
//         });

//         delete userState[userId]; // Reinicia el estado del usuario
//       } catch (error) {
//         console.error('Error with OpenAI:', error);
//         ctx.reply('Oops! Something went wrong while processing your data.');
//       }
//     } else {
//       ctx.reply(getErrorMessage(state));
//     }
//   }
// });

// Inicia el webhook de Telegram
const WEBHOOK_URL = `${process.env.WEBHOOK_BASE_URL}/webhook`;

app.use(bot.webhookCallback('/webhook'));

app.listen(3000, () => {
  bot.telegram.setWebhook(WEBHOOK_URL);
  console.log('Server running on port 3000');
});

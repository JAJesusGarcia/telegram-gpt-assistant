import mongoose from 'mongoose';
const ConversationSchema = new mongoose.Schema({
  userId: String,
  messages: [
    {
      sender: String,
      text: String,
      timestamp: { type: Date, default: Date.now },
    },
  ],
});

const Conversation = mongoose.model('Conversation', ConversationSchema);

export default Conversation;

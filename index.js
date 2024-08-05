require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const UserModel = require('./Models/Users'); // Ensure the path is correct
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ThingSpeak channel configurations
const THINGSPEAK_CHANNELS = {
  OLD: {
    READ_API_KEY: process.env.THINGSPEAK_READ_API_KEY_OLD,
    WRITE_API_KEY: process.env.THINGSPEAK_WRITE_API_KEY_OLD,
    CHANNEL_ID: process.env.THINGSPEAK_CHANNEL_ID_OLD,
  },
  NEW: {
    READ_API_KEY: process.env.THINGSPEAK_READ_API_KEY_NEW,
    WRITE_API_KEY: process.env.THINGSPEAK_WRITE_API_KEY_NEW,
    CHANNEL_ID: process.env.THINGSPEAK_CHANNEL_ID_NEW,
  },
};

// MongoDB connection using environment variable for URI
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await UserModel.findOne({ email });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        res.json({ message: 'Success', user });
      } else {
        res.status(401).json({ message: 'Incorrect password' });
      }
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Registration endpoint
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await UserModel.create({ email, password: hashedPassword });
    res.json(newUser);
  } catch (err) {
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to fetch data from ThingSpeak
async function fetchData(channel, field) {
  try {
    const response = await axios.get(`https://api.thingspeak.com/channels/${channel.CHANNEL_ID}/fields/${field}.json?api_key=${channel.READ_API_KEY}&results=1`);
    const data = response.data.feeds[0][`field${field}`];
    if (data && !isNaN(data) && data !== 'nan') {
      return { data };
    } else {
      throw new Error(`${field} data is invalid or unavailable`);
    }
  } catch (error) {
    console.error(`Error fetching ${field} data:`, error.response ? error.response.data : error.message);
    throw new Error(`Error fetching ${field} data`);
  }
}

// Temperature endpoint for old channel
app.get('/api/temperature', async (req, res) => {
  try {
    const oldData = await fetchData(THINGSPEAK_CHANNELS.OLD, 1);
    res.json({ temperature: oldData.data });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Humidity endpoint for old channel
app.get('/api/humidity', async (req, res) => {
  try {
    const oldData = await fetchData(THINGSPEAK_CHANNELS.OLD, 2);
    res.json({ humidity: oldData.data });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Gas Monitoring endpoint for old channel
app.get('/api/gas', async (req, res) => {
  try {
    const oldData = await fetchData(THINGSPEAK_CHANNELS.OLD, 3);
    res.json({ gas: oldData.data });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Flame Detection endpoint for old channel
app.get('/api/flame', async (req, res) => {
  try {
    const oldData = await fetchData(THINGSPEAK_CHANNELS.OLD, 4);
    res.json({ flame: oldData.data });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Plant Watering System endpoint for new channel
app.get('/api/plant-watering/moisture', async (req, res) => {
  try {
    const newData = await fetchData(THINGSPEAK_CHANNELS.NEW, 1);
    res.json({ moisture: newData.data });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Pump control endpoint
app.post('/api/pump-control', (req, res) => {
  const { action } = req.body;
  if (!action) {
    return res.status(400).send('Action is required');
  }
  // Your logic to handle the pump action
  console.log(`Pump action: ${action}`);
  res.send(`Pump action ${action} executed`);
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

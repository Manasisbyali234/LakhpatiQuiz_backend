require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Question = require('./models/Question');

// [text, [options], correctIndex, level, category]
const QUESTIONS = [
  // Level 1 – ₹1,000
  ['What is the capital of India?', ['Mumbai', 'New Delhi', 'Kolkata', 'Chennai'], 1, 1, 'Geography'],
  ['How many days are there in a leap year?', ['365', '366', '364', '367'], 1, 1, 'General Knowledge'],
  ['Which colour is in the middle of the Indian national flag?', ['Saffron', 'White', 'Green', 'Blue'], 1, 1, 'General Knowledge'],
  // Level 2 – ₹2,000
  ['Who wrote the Indian national anthem "Jana Gana Mana"?', ['Bankim Chandra Chatterjee', 'Rabindranath Tagore', 'Sarojini Naidu', 'Subhash Chandra Bose'], 1, 2, 'History'],
  ['Which animal is the national animal of India?', ['Lion', 'Elephant', 'Tiger', 'Leopard'], 2, 2, 'General Knowledge'],
  ['Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Mercury'], 1, 2, 'Science'],
  // Level 3 – ₹3,000
  ['What is the currency of Japan?', ['Won', 'Yuan', 'Yen', 'Ringgit'], 2, 3, 'General Knowledge'],
  ['Which is the largest ocean on Earth?', ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean', 'Pacific Ocean'], 3, 3, 'Geography'],
  ['Which gas do plants absorb from the air for photosynthesis?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2, 3, 'Science'],
  // Level 4 – ₹5,000
  ['In which city is the Taj Mahal located?', ['Delhi', 'Agra', 'Jaipur', 'Lucknow'], 1, 4, 'History'],
  ['Who is known as the "Father of the Nation" in India?', ['Jawaharlal Nehru', 'Sardar Patel', 'Mahatma Gandhi', 'B. R. Ambedkar'], 2, 4, 'History'],
  ['What is the chemical symbol for gold?', ['Go', 'Gd', 'Au', 'Ag'], 2, 4, 'Science'],
  // Level 5 – ₹10,000 (checkpoint)
  ['Who was the first Prime Minister of India?', ['Lal Bahadur Shastri', 'Jawaharlal Nehru', 'Indira Gandhi', 'Rajendra Prasad'], 1, 5, 'History'],
  ['Which is the smallest state of India by area?', ['Sikkim', 'Tripura', 'Goa', 'Manipur'], 2, 5, 'Geography'],
  ['Which is the largest planet in our solar system?', ['Saturn', 'Jupiter', 'Neptune', 'Uranus'], 1, 5, 'Science'],
  // Level 6 – ₹20,000
  ['Which city is popularly known as the "Pink City" of India?', ['Jodhpur', 'Udaipur', 'Jaipur', 'Bikaner'], 2, 6, 'Geography'],
  ['Who was the first woman Prime Minister of India?', ['Pratibha Patil', 'Indira Gandhi', 'Sarojini Naidu', 'Sonia Gandhi'], 1, 6, 'History'],
  ['Which Indian state has the longest coastline?', ['Tamil Nadu', 'Kerala', 'Gujarat', 'Maharashtra'], 2, 6, 'Geography'],
  // Level 7 – ₹40,000
  ['Who discovered penicillin?', ['Louis Pasteur', 'Alexander Fleming', 'Robert Koch', 'Edward Jenner'], 1, 7, 'Science'],
  ['In which city is the headquarters of ISRO located?', ['Hyderabad', 'Thiruvananthapuram', 'Bengaluru', 'Sriharikota'], 2, 7, 'Science'],
  ['Which is the largest hot desert in the world?', ['Gobi', 'Arabian', 'Kalahari', 'Sahara'], 3, 7, 'Geography'],
  // Level 8 – ₹80,000
  ['Who wrote the book "The Discovery of India"?', ['Mahatma Gandhi', 'Jawaharlal Nehru', 'Rabindranath Tagore', 'S. Radhakrishnan'], 1, 8, 'History'],
  ['In which year was the Battle of Plassey fought?', ['1757', '1764', '1857', '1699'], 0, 8, 'History'],
  ['Which Article of the Indian Constitution abolishes untouchability?', ['Article 14', 'Article 15', 'Article 17', 'Article 21'], 2, 8, 'Polity'],
  // Level 9 – ₹1,60,000 (checkpoint)
  ['Who was the first Indian to win a Nobel Prize?', ['C. V. Raman', 'Rabindranath Tagore', 'Mother Teresa', 'Amartya Sen'], 1, 9, 'History'],
  ['Which vitamin does the human body produce when skin is exposed to sunlight?', ['Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin K'], 2, 9, 'Science'],
  ['The famous Brihadeeswarar Temple, built by the Cholas, is in which city?', ['Madurai', 'Thanjavur', 'Kanchipuram', 'Hampi'], 1, 9, 'History'],
  // Level 10 – ₹3,20,000
  ['Who was the first Indian to travel into space?', ['Kalpana Chawla', 'Rakesh Sharma', 'Ravish Malhotra', 'Sunita Williams'], 1, 10, 'Science'],
  ['In which year did Chandrayaan-3 land near the Moon\'s south pole?', ['2019', '2021', '2023', '2022'], 2, 10, 'Science'],
  ['Who is traditionally credited as the author of the Arthashastra?', ['Kalidasa', 'Kautilya', 'Valmiki', 'Banabhatta'], 1, 10, 'History'],
  // Level 11 – ₹5,00,000
  ['Who was the first Chief Election Commissioner of India?', ['T. N. Seshan', 'Sukumar Sen', 'S. P. Sen Verma', 'K. V. K. Sundaram'], 1, 11, 'Polity'],
  ['What was the name of the first Indian satellite, launched in 1975?', ['Bhaskara', 'Rohini', 'Aryabhata', 'INSAT-1A'], 2, 11, 'Science'],
  ['The Tropic of Cancer does NOT pass through which of these states?', ['Gujarat', 'Jharkhand', 'Odisha', 'Mizoram'], 2, 11, 'Geography'],
];

(async () => {
  await connectDB();

  const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  let admin = await User.findOne({ email });
  if (!admin) {
    admin = await User.create({
      name: process.env.ADMIN_NAME || 'Quiz Admin',
      email,
      password: await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@12345', 10),
      role: 'admin',
    });
    console.log(`Admin created: ${email}`);
  } else {
    console.log(`Admin already exists: ${email}`);
  }

  if ((await Question.countDocuments()) === 0) {
    await Question.insertMany(
      QUESTIONS.map(([text, options, correctIndex, level, category]) => ({
        text, options, correctIndex, level, category, status: 'approved', createdBy: admin._id,
      }))
    );
    console.log(`Inserted ${QUESTIONS.length} sample questions`);
  } else {
    console.log('Questions already exist, skipping sample data');
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

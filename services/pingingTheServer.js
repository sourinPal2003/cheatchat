import fetch from 'node-fetch';

const pingServer = async () => {
  try {
    const response = await fetch('https://cheatchat.onrender.com/ping'); // Use your actual domain or localhost if running locally
    if (response.ok) {
      console.log('Server is forcefully stay actived by pingingTheServer');
    } else {
      console.error('Ping activate failed with status:', response.status);
    }
  } catch (error) {
    console.error('Ping activate failed with error:', error);
  }
};

// Function to start the pinging process
const startPinging = () => {
  setInterval(pingServer, 600000); // Ping every 10 minutes (600000 ms)
  pingServer(); // Initial ping to start the cycle
};

export default startPinging;

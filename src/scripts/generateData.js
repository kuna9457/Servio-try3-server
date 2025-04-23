import fetch from 'node-fetch';

const generateData = async () => {
  try {
    const response = await fetch('http://localhost:5000/api/services/generate-sample-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    console.log('Sample data generated successfully:', data);
  } catch (error) {
    console.error('Error generating sample data:', error);
  }
};

generateData(); 
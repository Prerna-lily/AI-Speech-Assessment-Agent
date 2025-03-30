import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import './App.css';

function App() {
  const [studentName, setStudentName] = useState('');
  const [subject, setSubject] = useState('');
  const [currentStep, setCurrentStep] = useState('instructions');
  const [studentAnswer, setStudentAnswer] = useState('');
  const [applicationsAnswer, setApplicationsAnswer] = useState('');
  const [question3Answer, setQuestion3Answer] = useState(''); // New state for third question
  const [question4Answer, setQuestion4Answer] = useState(''); // New state for fourth question
  const [feedback, setFeedback] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [webcamActive, setWebcamActive] = useState(false);
  const videoRef = useRef(null);
  const recognitionRef = useRef(null);
  const modelRef = useRef(null);
  const lastPersonDetected = useRef(Date.now());
  const [showWebcamPreview, setShowWebcamPreview] = useState(false);

  const synth = window.speechSynthesis;

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
    } else {
      console.error('SpeechRecognition API not supported.');
    }

    const loadModel = async () => {
      await tf.setBackend('webgl');
      const model = await cocoSsd.load();
      modelRef.current = model;
      console.log('COCO-SSD model loaded');
    };
    loadModel();

    const handleVisibilityChange = () => {
      if (currentStep === 'instructions' || currentStep === 'complete') return;
      
      const navigationEntries = performance.getEntriesByType("navigation");
      const isPageRefresh = navigationEntries.some(entry => entry.type === "reload");
      
      if (document.hidden && !isPageRefresh) {
        addWarning('Tab switching detected! Please stay on the exam tab.');
      }
    };
  
    document.addEventListener('visibilitychange', handleVisibilityChange);

    if (currentStep !== 'instructions' && !webcamActive) {
      startWebcam();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (recognitionRef.current) recognitionRef.current.stop();
      stopWebcam();
    };
  }, [currentStep]);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebcamActive(true);
        setShowWebcamPreview(true);
        detectObjects();
      }
    } catch (err) {
      console.error('Error accessing webcam:', err);
      setError('Webcam access denied. Please allow webcam access to proceed.');
      speak('Webcam access denied. Please allow webcam access to proceed.');
    }
  };

  const stopWebcam = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setWebcamActive(false);
    }
  };

  const detectObjects = async () => {
    if (!modelRef.current || !videoRef.current || !webcamActive) return;

    const video = videoRef.current;
    const predictions = await modelRef.current.detect(video);
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let personDetected = false;

    predictions.forEach(prediction => {
      const [x, y, width, height] = prediction.bbox;
      ctx.strokeStyle = prediction.class === 'person' ? 'green' : 'red';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);
      ctx.fillStyle = prediction.class === 'person' ? 'green' : 'red';
      ctx.fillText(`${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`, x, y - 5);

      if (prediction.class === 'person' && prediction.score > 0.7) {
        personDetected = true;
        lastPersonDetected.current = Date.now();
      }

      if ((prediction.class === 'cell phone' || prediction.class === 'mobile phone') && prediction.score > 0.6 && currentStep !== 'complete' && currentStep !== 'instructions') {
        addWarning('Mobile phone detected! Mobile phones are not allowed.');
      }
    });

    if (!personDetected && currentStep !== 'complete' && currentStep !== 'instructions') {
      const timeSinceLastPerson = (Date.now() - lastPersonDetected.current) / 1000;
      if (timeSinceLastPerson > 5) {
        addWarning('No person detected! Please stay in front of the webcam.');
      }
    }

    if (webcamActive) {
      requestAnimationFrame(detectObjects);
    }
  };

  const addWarning = (message) => {
    setWarnings(prev => {
      const newWarnings = [...prev, `${new Date().toLocaleTimeString()} - ${message}`];
      if (newWarnings.length >= 3) {
        speak('Exam terminated due to repeated violations.');
        setError('Exam terminated due to repeated violations.');
        setFeedback('You have failed the assessment due to repeated violations.');
        setCurrentStep('complete');
        stopWebcam();
      }
      return newWarnings;
    });
    speak(message);
  };

  const speak = (text, nextStep) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => nextStep && nextStep();
    synth.speak(utterance);
  };

  const startListening = (setValue, nextStep) => {
    if (!recognitionRef.current || isListening) return;
  
    setIsListening(true);
    const recognition = recognitionRef.current;
  
    // Enable interim results for better responsiveness
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.lang = 'en-US';
  
    let finalTranscript = '';
  
    recognition.onstart = () => {
      console.log('Listening started');
      setError('');
    };
  
    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim();
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
  
      console.log('Interim:', interimTranscript);
      console.log('Final:', finalTranscript);
  
      if (finalTranscript) {
        setValue(finalTranscript);
        setIsListening(false);
        if (nextStep) {
          setTimeout(() => nextStep(finalTranscript), 500);
        }
      }
    };
  
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      setError(`Speech recognition failed: ${event.error}. Please speak louder or clearer.`);
      speak('Sorry, I couldn’t hear you clearly. Please speak louder or try again.', () =>
        setTimeout(() => startListening(setValue, nextStep), 2000)
      );
    };
  
    recognition.onend = () => {
      console.log('Listening ended');
      if (!finalTranscript) {
        setIsListening(false);
        speak('I didn’t catch that. Please try again.', () =>
          setTimeout(() => startListening(setValue, nextStep), 1000)
        );
      }
    };
  
    try {
      recognition.start();
    } catch (error) {
      console.error('Error starting recognition:', error);
      setIsListening(false);
      setError('Error starting speech recognition. Retrying...');
      speak('Error starting. Retrying...', () =>
        setTimeout(() => startListening(setValue, nextStep), 2000)
      );
    }
  };

  const quitExam = () => {
    setFeedback('You have chosen to quit the assessment.');
    setCurrentStep('complete');
    speak('You have quit the assessment. Goodbye.');
    stopWebcam();
  };

  const startExam = () => {
    setCurrentStep('name');
    speak("Hello! Welcome to the AI Assessment Agent. What is your name?", () =>
      startListening(setStudentName, (name) => {
        if (!name || name.trim() === '') {
          speak("I didn't catch your name. Please try again.", () => 
            startListening(setStudentName, askSubject)
          );
        } else {
          askSubject();
        }
      })
    );
  };

  const extractKeywords = (text) => {
    // Remove common stop words and split into words
    const stopWords = ['a', 'an', 'the', 'is', 'are', 'was', 'were', 'in', 'on', 'to', 'for', 'with', 'about', 'of'];
    const words = text.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/);
    const keywords = words.filter(word => !stopWords.includes(word) && word.length > 3);
    
    // Return the top 2 most frequent or relevant keywords (simplified)
    const keywordFreq = keywords.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
    
    return Object.keys(keywordFreq)
      .sort((a, b) => keywordFreq[b] - keywordFreq[a])
      .slice(0, 2);
  };

  const askSubject = () => {
    setCurrentStep('subject');
    speak(`Nice to meet you, ${studentName}! What subject did you study today?`, () =>
      startListening(setSubject, (subjectAnswer) => {
        const extractedSubject = extractSubject(subjectAnswer);
        if (!extractedSubject) {
          speak("I didn't understand the subject. Please say it again.", () =>
            startListening(setSubject, askSubject)
          );
        } else {
          askTopic(extractedSubject);
        }
      })
    );
  };

  const askTopic = (extractedSubject) => {
    setCurrentStep('topic');
    speak(`Great! What specific topic did you learn about in ${extractedSubject} today? Please give a detailed explanation.`, () =>
      startListening(setStudentAnswer, (answer) => {
        if (!answer || answer.trim() === '') {
          speak("I didn't hear your explanation. Please try again.", () =>
            startListening(setStudentAnswer, (newAnswer) => askApplications(extractedSubject, newAnswer))
          );
        } else {
          const keywords = extractKeywords(answer);
          askApplications(extractedSubject, answer, keywords);
        }
      })
    );
  };

  const askApplications = (subjectValue, topicAnswer, keywords = []) => {
    setCurrentStep('applications');
    const keywordText = keywords.length > 0 ? `related to ${keywords.join(' and ')}` : '';
    speak(`Thanks! What are some real-time applications of ${topicAnswer} in ${subjectValue} ${keywordText}? Please provide concrete examples.`, () =>
      startListening(setApplicationsAnswer, (answer) => {
        if (!answer || answer.trim() === '') {
          speak("I didn't hear your examples. Please try again.", () =>
            startListening(setApplicationsAnswer, (newAnswer) => askQuestion3(subjectValue, topicAnswer, newAnswer, keywords))
          );
        } else {
          const newKeywords = extractKeywords(answer);
          askQuestion3(subjectValue, topicAnswer, answer, newKeywords);
        }
      })
    );
  };

  const askQuestion3 = (subjectValue, topicAnswer, applicationsAnswer, keywords = []) => {
    setCurrentStep('question3');
    const keywordText = keywords.length > 0 ? `especially regarding ${keywords.join(' and ')}` : '';
    speak(`Good! How does ${topicAnswer} impact ${subjectValue} in modern technology ${keywordText}? Please explain in detail.`, () =>
      startListening(setQuestion3Answer, (answer) => {
        if (!answer || answer.trim() === '') {
          speak("I didn't hear your explanation. Please try again.", () =>
            askQuestion3(subjectValue, topicAnswer, applicationsAnswer, keywords)
          );
        } else {
          const newKeywords = extractKeywords(answer);
          askQuestion4(subjectValue, topicAnswer, applicationsAnswer, answer, newKeywords);
        }
      })
    );
  };

  const askQuestion4 = (subjectValue, topicAnswer, applicationsAnswer, question3Answer, keywords = []) => {
  setCurrentStep('question4');
  const keywordText = keywords.length > 0 ? `focusing on ${keywords.join(' and ')}` : '';
  speak(`Nice! What challenges might arise when implementing ${topicAnswer} in ${subjectValue} ${keywordText}? Please provide specific examples.`, () =>
    startListening(setQuestion4Answer, (answer) => {
      if (!answer || answer.trim() === '') {
        speak("I didn't hear your examples. Please try again.", () =>
          askQuestion4(subjectValue, topicAnswer, applicationsAnswer, question3Answer, keywords)
        );
      } else {
        evaluateAnswer(subjectValue, topicAnswer, applicationsAnswer, question3Answer, answer);
      }
    })
  );
};

  const extractSubject = (answer) => {
    const subjectMatch = answer.match(/(mathematics|math|science|history|english|physics|chemistry|biology)/i);
    return subjectMatch ? subjectMatch[0] : answer.replace(/studied about/i, '').trim();
  };

  const failAssessment = (reason) => {
    setFeedback(`You have failed the assessment. Reason: ${reason}`);
    setCurrentStep('complete');
    speak(`You have failed the assessment due to ${reason}`);
    stopWebcam();
  };

  const evaluateAnswer = async (subjectValue, topicAnswer, applicationsAnswer, question3Answer, question4Answer) => {
    const question1 = `What specific topic did you learn about in ${subjectValue} today? Please give a detailed explanation.`;
    const question2 = `What are some real-life applications of ${topicAnswer} in ${subjectValue}? Please provide a detailed explanation.`;
    const question3 = `How does ${topicAnswer} impact ${subjectValue} in modern technology? Please explain in detail.`;
    const question4 = `What challenges might arise when implementing ${topicAnswer} in ${subjectValue}? Please provide specific examples.`;

    try {
      const response = await fetch('http://localhost:5000/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question1, answer1: topicAnswer, 
          question2, answer2: applicationsAnswer,
          question3, answer3: question3Answer,
          question4, answer4: question4Answer
        }),
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const data = await response.json();
      setFeedback(data.feedback);
      setCurrentStep('complete');

      const scoreMatch = data.feedback.match(/Score: (\d+)/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

      const examData = {
        student_name: studentName,
        subject: subjectValue,
        topic: topicAnswer,
        score: score,
        cheated: warnings.length > 0,
        entry_time: new Date().toISOString(),
      };

      const storeResponse = await fetch('http://localhost:5000/store-exam-result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examData),
      });

      if (!storeResponse.ok) throw new Error(`Store Error: ${storeResponse.status}`);
      console.log('Exam result stored successfully');

      const thankYouMessage = "Your assessment is completed. Thank you!";
      speak(thankYouMessage);
      alert(thankYouMessage);
      stopWebcam();

    } catch (error) {
      console.error('Error:', error);
      setError(`Error: ${error.message}. Retrying in 3 seconds...`);
      speak('There was an issue. Retrying.', () =>
        setTimeout(() => evaluateAnswer(subjectValue, topicAnswer, applicationsAnswer, question3Answer, question4Answer), 3000)
      );
    }
  };

  return (
    <div className="App">
      <h1>AI Speech Assessment Agent</h1>
  
      {currentStep === 'instructions' && (
        <div>
          <h2>Instructions</h2>
          <p>This system is designed to test your knowledge based on the material covered in your class today.</p>
          <ul>
            <li>Ensure you are in a quiet environment with a working webcam.</li>
            <li>The webcam must remain on throughout the assessment.</li>
            <li>You must stay in front of the screen.</li>
            <li>Mobile phones or other objects are not allowed.</li>
            <li>Three warnings will terminate the assessment, resulting in failure.</li>
            <li>You can quit the exam at any time using the Quit button.</li>
          </ul>
          <button onClick={startExam}>Start Exam</button>
        </div>
      )}
  
      {showWebcamPreview && (
        <div className="webcam-preview">
          <video 
            ref={videoRef} 
            autoPlay 
            muted
            playsInline
          />
        </div>
      )}
  
      {isListening && (
        <>
          <div className="listening-indicator">
            <span>Listening...</span>
          </div>
          <div className="listening-state">
            Speak now - I'm listening to your answer
          </div>
        </>
      )}
  
      {currentStep === 'name' && (
        <div className="question-container">
          <h3>What is your name?</h3>
          {studentName ? (
            <p className="answer-feedback">You said: <strong>{studentName}</strong></p>
          ) : (
            <p className="instruction-text">Please say your name clearly</p>
          )}
        </div>
      )}
  
      {currentStep === 'subject' && (
        <div className="question-container">
          <h3>What subject did you study today?</h3>
          {subject ? (
            <p className="answer-feedback">You said: <strong>{subject}</strong></p>
          ) : (
            <p className="instruction-text">Please name your subject</p>
          )}
        </div>
      )}
  
      {currentStep === 'topic' && (
        <div>
          <p>Question: What specific topic did you learn about in {subject} today? Please give a detailed explanation.</p>
          {studentName && <p>Student: {studentName}</p>}
          {subject && <p>Subject: {subject}</p>}
          {studentAnswer && <p>Your Answer: {studentAnswer}</p>}
          {isListening && <p>Listening for your explanation...</p>}
        </div>
      )}
  
      {currentStep === 'applications' && (
        <div>
          <p>Question: What are some real-life applications of your topic in {subject}?</p>
          {studentName && <p>Student: {studentName}</p>}
          {subject && <p>Subject: {subject}</p>}
          {studentAnswer && <p>Topic Answer: {studentAnswer}</p>}
          {applicationsAnswer && <p>Your Answer: {applicationsAnswer}</p>}
          {isListening && <p>Listening for your explanation...</p>}
        </div>
      )}
  
      {currentStep === 'question3' && (
        <div>
          <p>Question: How does {studentAnswer} impact {subject} in modern technology?</p>
          {studentName && <p>Student: {studentName}</p>}
          {subject && <p>Subject: {subject}</p>}
          {studentAnswer && <p>Topic Answer: {studentAnswer}</p>}
          {question3Answer && <p>Your Answer: {question3Answer}</p>}
          {isListening && <p>Listening for your explanation...</p>}
        </div>
      )}
  
      {currentStep === 'question4' && (
        <div>
          <p>Question: What challenges might arise when implementing {studentAnswer} in {subject}?</p>
          {studentName && <p>Student: {studentName}</p>}
          {subject && <p>Subject: {subject}</p>}
          {studentAnswer && <p>Topic Answer: {studentAnswer}</p>}
          {question4Answer && <p>Your Answer: {question4Answer}</p>}
          {isListening && <p>Listening for your explanation...</p>}
        </div>
      )}
  
      {currentStep === 'complete' && (
        <div>
          <h2>Assessment Complete!</h2>
          <p>Student: {studentName}</p>
          <p>Subject: {subject}</p>
          <p>Question 1: What specific topic did you learn about in {subject} today? Please give a detailed explanation.</p>
          <p>Your Answer: {studentAnswer}</p>
          <p>Question 2: What are some real-life applications of {studentAnswer} in {subject}?</p>
          <p>Your Answer: {applicationsAnswer}</p>
          <p>Question 3: How does {studentAnswer} impact {subject} in modern technology?</p>
          <p>Your Answer: {question3Answer}</p>
          <p>Question 4: What challenges might arise when implementing {studentAnswer} in {subject}?</p>
          <p>Your Answer: {question4Answer}</p>
          {feedback && (
            <div>
              <p>Feedback: {feedback}</p>
            </div>
          )}
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      )}
  
      {webcamActive && (
        <div>
          <h3>Webcam Feed</h3>
          <video ref={videoRef} autoPlay width="320" height="240" />
          <canvas id="canvas" width="320" height="240" style={{ position: 'absolute' }} />
        </div>
      )}
  
      {warnings.length > 0 && (
        <div style={{ color: 'orange' }}>
          <h3>Warnings</h3>
          <ul>
            {warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
  
      {/* Moved Quit Exam button to the bottom */}
      {currentStep !== 'instructions' && currentStep !== 'complete' && (
        <div style={{ marginTop: '20px', padding: '20px 0', borderTop: '1px solid #ccc' }}>
          <button 
            onClick={quitExam} 
            style={{ 
              backgroundColor: 'red', 
              color: 'white',
              padding: '10px 20px',
              fontSize: '16px',
              borderRadius: '5px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Quit Exam
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
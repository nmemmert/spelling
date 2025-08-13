// Helper function to render session words in a consistent way
function renderSessionWords(session) {
  // Handle different data formats
  if (session.answers && Array.isArray(session.answers)) {
    return session.answers.map(a => 
      `<li>${a.word} - ${a.correct ? '✅ Correct' : '❌ Incorrect'}</li>`
    ).join('');
  } 
  else if (session.words && Array.isArray(session.words)) {
    return session.words.map(w => 
      `<li>${w.word} - ${w.correct ? '✅ Correct' : '❌ Incorrect'}</li>`
    ).join('');
  }
  return '<li>No word details available</li>';
}

// Update the export function to handle different data formats
window.exportSessionReport = function(username, session) {
  if (!session) return;
  
  // Support both timestamp and date fields
  const sessionDate = session.timestamp || session.date || Date.now();
  const date = new Date(sessionDate).toLocaleDateString();
  
  const score = session.score || session.correct || 0;
  
  // Handle both answers array and words array formats
  let total = 0;
  let answersArray = [];
  
  if (session.answers && Array.isArray(session.answers)) {
    total = session.answers.length;
    answersArray = session.answers;
  } else if (session.words && Array.isArray(session.words)) {
    total = session.words.length;
    answersArray = session.words;
  } else if (session.total) {
    total = session.total;
  }
  
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  
  // Prepare report
  const correctWords = answersArray.filter(a => a.correct).map(a => a.word).join(', ');
  const incorrectWords = answersArray.filter(a => !a.correct).map(a => a.word).join(', ');
  
  const reportContent = `
Session Report for ${username}
Date: ${date}
Score: ${score}/${total} (${percent}%)
Correct Words: ${correctWords || 'None'}
Incorrect Words: ${incorrectWords || 'None'}
  `;
  
  // Create download link
  const blob = new Blob([reportContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${username}-session-${date.replace(/\//g, '-')}.txt`;
  link.click();
  URL.revokeObjectURL(url);
};

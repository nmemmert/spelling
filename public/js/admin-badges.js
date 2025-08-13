// Admin Badge Enhancement Functions

// Print a certificate for the student's badges
function printBadgeCertificate(username) {
  fetch('/getBadges')
    .then(res => res.json())
    .then(data => {
      const userBadgeData = data[username];
      let badges = [];
      
      // Handle different badge data formats
      if (!userBadgeData) {
        badges = [];
      } else if (Array.isArray(userBadgeData)) {
        // Old format
        badges = userBadgeData.map(name => ({ 
          name, 
          icon: "🏅", 
          color: "#4a5568" 
        }));
      } else if (userBadgeData.earned) {
        // New format
        badges = userBadgeData.earned;
      }
      
      if (badges.length === 0) {
        alert("No badges to print for this student.");
        return;
      }
      
      // Create certificate window
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Spelling Achievement Certificate - ${username}</title>
          <style>
            body {
              font-family: 'Arial', sans-serif;
              color: #1e293b;
              margin: 0;
              padding: 0;
              background-color: #f8fafc;
            }
            .certificate {
              max-width: 850px;
              margin: 20px auto;
              padding: 40px;
              background-color: white;
              border: 10px solid #4f46e5;
              border-radius: 10px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              position: relative;
            }
            .certificate:before {
              content: '';
              position: absolute;
              top: 10px;
              left: 10px;
              right: 10px;
              bottom: 10px;
              border: 2px solid #818cf8;
              border-radius: 5px;
              pointer-events: none;
            }
            .certificate-header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 2px solid #e2e8f0;
              padding-bottom: 20px;
            }
            .certificate-title {
              font-size: 32px;
              color: #4338ca;
              margin: 0 0 10px;
              font-weight: bold;
            }
            .certificate-subtitle {
              font-size: 20px;
              color: #6b7280;
              margin: 0;
            }
            .student-name {
              font-size: 28px;
              text-align: center;
              margin: 30px 0;
              color: #1e40af;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 15px;
            }
            .achievement-text {
              text-align: center;
              font-size: 18px;
              margin-bottom: 30px;
              color: #4b5563;
            }
            .badges-showcase {
              display: flex;
              flex-wrap: wrap;
              justify-content: center;
              gap: 15px;
              margin-bottom: 30px;
            }
            .badge-item {
              display: flex;
              align-items: center;
              background-color: #f1f5f9;
              padding: 10px 15px;
              border-radius: 50px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .badge-icon {
              font-size: 24px;
              margin-right: 10px;
            }
            .signature {
              display: flex;
              justify-content: space-between;
              margin-top: 50px;
            }
            .signature-line {
              width: 40%;
              border-top: 1px solid #64748b;
              padding-top: 10px;
              text-align: center;
              color: #64748b;
            }
            .date {
              text-align: right;
              margin-top: 20px;
              font-style: italic;
              color: #64748b;
            }
            .badge-count {
              text-align: center;
              font-size: 24px;
              margin-bottom: 20px;
              color: #4338ca;
              font-weight: bold;
            }
            .badge-dot {
              height: 15px;
              width: 15px;
              border-radius: 50%;
              display: inline-block;
              margin-right: 5px;
            }
            .certificate-border {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              border: 25px solid transparent;
              border-image: linear-gradient(45deg, #4f46e5, #818cf8) 1;
              pointer-events: none;
            }
            .print-button {
              display: block;
              margin: 20px auto;
              padding: 10px 20px;
              background-color: #4f46e5;
              color: white;
              border: none;
              border-radius: 5px;
              font-size: 16px;
              cursor: pointer;
            }
            @media print {
              .print-button {
                display: none;
              }
              body {
                background-color: white;
              }
              .certificate {
                box-shadow: none;
                margin: 0;
                padding: 40px;
              }
            }
          </style>
        </head>
        <body>
          <div class="certificate">
            <div class="certificate-header">
              <h1 class="certificate-title">Spelling Achievement Certificate</h1>
              <h2 class="certificate-subtitle">For Excellence in Vocabulary & Spelling</h2>
            </div>
            
            <p class="achievement-text">This certificate recognizes the outstanding achievements in spelling practice by:</p>
            <h2 class="student-name">${username}</h2>
            
            <p class="badge-count">Earned ${badges.length} Badge${badges.length !== 1 ? 's' : ''}</p>
            
            <div class="badges-showcase">
              ${badges.map(badge => `
                <div class="badge-item">
                  <span class="badge-dot" style="background-color: ${badge.color || '#4a5568'}"></span>
                  <span class="badge-icon">${badge.icon || '🏅'}</span>
                  <span>${badge.name}</span>
                </div>
              `).join('')}
            </div>
            
            <p class="achievement-text">Keep up the great work and continue building your vocabulary skills!</p>
            
            <div class="signature">
              <div class="signature-line">Teacher Signature</div>
              <div class="signature-line">School Administrator</div>
            </div>
            
            <div class="date">Date: ${new Date().toLocaleDateString()}</div>
          </div>
          
          <button class="print-button" onclick="window.print()">Print Certificate</button>
        </body>
        </html>
      `);
      
      printWindow.document.close();
    });
}

// Show modal for awarding custom badges
function showCustomBadgeModal(username) {
  // Create modal element if it doesn't exist
  let modal = document.getElementById('customBadgeModal');
  
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'customBadgeModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Award Custom Badge</h3>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <form id="customBadgeForm">
            <div class="form-group">
              <label for="badgeName">Badge Name</label>
              <input type="text" id="badgeName" class="form-control" required placeholder="e.g. Special Achievement">
            </div>
            
            <div class="form-group">
              <label for="badgeDescription">Description</label>
              <textarea id="badgeDescription" class="form-control" rows="3" placeholder="Describe the achievement"></textarea>
            </div>
            
            <div class="form-group">
              <label for="badgeIcon">Icon</label>
              <div class="icon-selector">
                <button type="button" class="icon-option selected" data-icon="🏅">🏅</button>
                <button type="button" class="icon-option" data-icon="🎯">🎯</button>
                <button type="button" class="icon-option" data-icon="⭐">⭐</button>
                <button type="button" class="icon-option" data-icon="🚀">🚀</button>
                <button type="button" class="icon-option" data-icon="🏆">🏆</button>
                <button type="button" class="icon-option" data-icon="🎓">🎓</button>
                <button type="button" class="icon-option" data-icon="📚">📚</button>
                <button type="button" class="icon-option" data-icon="🔥">🔥</button>
                <input type="hidden" id="badgeIcon" value="🏅">
              </div>
            </div>
            
            <div class="form-group">
              <label for="badgeColor">Color</label>
              <div class="color-selector">
                <button type="button" class="color-option selected" data-color="#3b82f6" style="background-color: #3b82f6;"></button>
                <button type="button" class="color-option" data-color="#10b981" style="background-color: #10b981;"></button>
                <button type="button" class="color-option" data-color="#ef4444" style="background-color: #ef4444;"></button>
                <button type="button" class="color-option" data-color="#f59e0b" style="background-color: #f59e0b;"></button>
                <button type="button" class="color-option" data-color="#8b5cf6" style="background-color: #8b5cf6;"></button>
                <button type="button" class="color-option" data-color="#ec4899" style="background-color: #ec4899;"></button>
                <input type="hidden" id="badgeColor" value="#3b82f6">
              </div>
            </div>
            
            <div class="form-group">
              <label for="badgeCategory">Category</label>
              <select id="badgeCategory" class="form-control">
                <option value="achievement">Achievement</option>
                <option value="mastery">Mastery</option>
                <option value="speed">Speed</option>
                <option value="consistency">Consistency</option>
                <option value="special">Special</option>
              </select>
            </div>
            
            <div class="badge-preview">
              <h4>Badge Preview</h4>
              <div id="badgePreview" class="admin-badge-card">
                <div class="admin-badge-icon" style="background-color: #3b82f640">
                  <span>🏅</span>
                </div>
                <div class="admin-badge-info">
                  <h4>Badge Title</h4>
                  <p class="admin-badge-desc">Badge description will appear here</p>
                </div>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary modal-close">Cancel</button>
          <button id="awardBadgeButton" class="btn-primary">Award Badge</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set up event listeners for the modal
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.classList.remove('show');
    });
    
    // Set up icon selector
    document.querySelectorAll('.icon-option').forEach(button => {
      button.addEventListener('click', function() {
        document.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        document.getElementById('badgeIcon').value = this.getAttribute('data-icon');
        updateBadgePreview();
      });
    });
    
    // Set up color selector
    document.querySelectorAll('.color-option').forEach(button => {
      button.addEventListener('click', function() {
        document.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
        this.classList.add('selected');
        document.getElementById('badgeColor').value = this.getAttribute('data-color');
        updateBadgePreview();
      });
    });
    
    // Set up live preview
    document.getElementById('badgeName').addEventListener('input', updateBadgePreview);
    document.getElementById('badgeDescription').addEventListener('input', updateBadgePreview);
    
    // Award badge button
    document.getElementById('awardBadgeButton').addEventListener('click', () => {
      const name = document.getElementById('badgeName').value.trim();
      if (!name) {
        alert('Please enter a badge name.');
        return;
      }
      
      const badgeData = {
        id: name.toLowerCase().replace(/\s/g, '_'),
        name: name,
        description: document.getElementById('badgeDescription').value.trim(),
        icon: document.getElementById('badgeIcon').value,
        color: document.getElementById('badgeColor').value,
        category: document.getElementById('badgeCategory').value
      };
      
      // Send request to award badge
      fetch('/awardBadges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          badges: [badgeData]
        })
      })
      .then(res => res.text())
      .then(() => {
        modal.classList.remove('show');
        // Refresh the badge display
        showUserBadges(username);
      })
      .catch(err => {
        console.error('Error awarding badge:', err);
        alert('Error awarding badge. Please try again.');
      });
    });
    
    // Function to update badge preview
    function updateBadgePreview() {
      const previewIcon = document.querySelector('#badgePreview .admin-badge-icon span');
      const previewTitle = document.querySelector('#badgePreview .admin-badge-info h4');
      const previewDesc = document.querySelector('#badgePreview .admin-badge-desc');
      const previewIconBg = document.querySelector('#badgePreview .admin-badge-icon');
      const previewCard = document.querySelector('#badgePreview');
      
      const icon = document.getElementById('badgeIcon').value;
      const color = document.getElementById('badgeColor').value;
      const name = document.getElementById('badgeName').value.trim() || 'Badge Title';
      const description = document.getElementById('badgeDescription').value.trim() || 'Badge description will appear here';
      
      previewIcon.textContent = icon;
      previewTitle.textContent = name;
      previewDesc.textContent = description;
      previewIconBg.style.backgroundColor = `${color}40`;
      previewCard.style.borderColor = color;
    }
  }
  
  // Update modal title with username
  modal.querySelector('.modal-header h3').textContent = `Award Custom Badge to ${username}`;
  
  // Show modal
  modal.classList.add('show');
}

// Additional styling for the modal
const modalStyle = document.createElement('style');
modalStyle.textContent = `
  .modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0,0,0,0.5);
    overflow: auto;
  }
  
  .modal.show {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .modal-content {
    background-color: var(--bg-primary);
    border-radius: var(--radius);
    max-width: 600px;
    width: 100%;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    animation: modalFadeIn 0.3s;
  }
  
  @keyframes modalFadeIn {
    from { opacity: 0; transform: translateY(-20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .modal-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .modal-header h3 {
    margin: 0;
  }
  
  .modal-close {
    background: transparent;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
  }
  
  .modal-body {
    padding: 1.5rem;
    max-height: 70vh;
    overflow-y: auto;
  }
  
  .modal-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }
  
  .form-group {
    margin-bottom: 1.25rem;
  }
  
  .form-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }
  
  .icon-selector, .color-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .icon-option {
    width: 40px;
    height: 40px;
    font-size: 1.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-secondary);
    border: 2px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
  }
  
  .icon-option.selected {
    border-color: var(--primary);
    background: var(--primary-light);
  }
  
  .color-option {
    width: 40px;
    height: 40px;
    border: 2px solid var(--border);
    border-radius: 50%;
    cursor: pointer;
  }
  
  .color-option.selected {
    border-color: var(--text-primary);
    transform: scale(1.1);
    box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--primary);
  }
  
  .badge-preview {
    margin-top: 2rem;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
  
  .badge-preview h4 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--text-secondary);
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
`;

document.head.appendChild(modalStyle);

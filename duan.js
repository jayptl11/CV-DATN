/* ==========================================================================
   CARBON ATS - CORE LOGIC V3.0 (TÍCH HỢP NODE.JS & MODAL QUICK VIEW)
   Author: Kỹ sư giao diện Tùng & AI
   ========================================================================== */

   let candidates = [];
   let savedStatuses = JSON.parse(localStorage.getItem('carbonColumnState')) || {};
   
   function saveColumnState() {
       localStorage.setItem('carbonColumnState', JSON.stringify(savedStatuses));
   }
   
   // Hàm phụ: Lấy 2 chữ cái đầu làm Avatar
   function getInitials(name) {
       if(!name) return "NV";
       let cleanName = name.split(' - ')[0]; 
       let parts = cleanName.split(' ');
       if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase();
       return cleanName.substring(0, 2).toUpperCase();
   }
   
   // 1. TẢI DỮ LIỆU TỪ NODE.JS
   async function fetchCandidatesFromBackend() {
       try {
           const API_BASE = window.API_BASE_URL || 'http://localhost:3000';
           const response = await fetch(`${API_BASE}/api/candidates`);
           if (!response.ok) throw new Error("Không kết nối được Node.js");
           
           const dbData = await response.json();
           
           // Tiền xử lý dữ liệu trước khi đúc thành thẻ Kanban
           candidates = dbData.map(cand => {
               // Lấy điểm AI (đảm bảo nó là số)
               const score = parseInt(cand.aiScore) || 0;
               const isPass = cand.isPass === true || cand.isPass === "true" || score >= 70;
               const uid = cand.id || cand._id || `cv-${Date.now()}-${Math.random()}`;
               
               // Tránh tình trạng Tên bị nối SĐT 2 lần
               const fullName = (cand.phone && !cand.name.includes('-')) ? `${cand.name} - ${cand.phone}` : cand.name;

               // Lấy trạng thái kéo thả cũ (nếu có)
               let currentStatus = savedStatuses[uid];

               // ========================================================
               // THUẬT TOÁN AUTO-REJECT (TỰ ĐỘNG LOẠI CV < 50%)
               // ========================================================
               if (!currentStatus) {
                   if (score < 50) {
                       currentStatus = 'col-rejected'; // Đuổi thẳng ra đảo!
                   } else {
                       currentStatus = 'col-new'; // Đủ điểm thì cho vào cột Chờ xử lý
                   }
               }
               // ========================================================

               return {
                   id: uid,
                   name: fullName,
                   position: cand.position,
                   status: currentStatus, 
                   aiScore: score,
                   isPass: isPass,
                   aiReason: cand.aiReason || "Hồ sơ đang chờ xử lý...",
                   cvUrl: cand.cvUrl 
               };
           });

           // Cập nhật lại bộ nhớ trình duyệt
           localStorage.setItem('carbonCandidates', JSON.stringify(candidates));
           
           // Gọi hàm vẽ giao diện bảng Kanban
           renderBoard();

       } catch (error) {
           console.error("Lỗi đồng bộ dữ liệu:", error);
       }
   }
   
   // 2. KHỞI TẠO BẢNG 
   function renderBoard() {
       const kanbanBoard = document.querySelector('.kanban-board');
       if (!kanbanBoard) return; 
   
       document.querySelectorAll('.column-body').forEach(col => col.innerHTML = '');
   
       candidates.forEach(candidate => createCardElement(candidate));
   
       updateCounts();
       setupDragAndDrop(); 
   }
   
   // 3. TẠO NODE DOM TRỰC TIẾP
   function createCardElement(candidate) {
       let initials = getInitials(candidate.name);
       
       const card = document.createElement("div");
       card.className = "candidate-card";
       card.draggable = true;
       card.id = candidate.id;
   
       card.onclick = () => openCvModal(candidate.id);
       
       card.addEventListener('dragstart', (ev) => {
           ev.dataTransfer.setData("text", ev.target.id);
           ev.dataTransfer.effectAllowed = "move";
           setTimeout(() => card.classList.add("dragging"), 0);
       });
   
       card.addEventListener('dragend', () => {
           card.classList.remove("dragging");
           document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('drag-over'));
       });
       
       const badgeColor = candidate.isPass ? '#10b981' : '#ef4444'; 
       const badgeBg = candidate.isPass ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
       const statusText = candidate.isPass ? 'PASS' : 'REVIEW';
   
       card.innerHTML = `
           <div class="card-header">
               <div class="cand-avatar">${initials}</div>
               <div class="cand-info">
                   <div class="candidate-name">${candidate.name.split(' - ')[0]}</div>
                   <div class="cand-time"><i class="fas fa-phone-alt" style="font-size:9px; margin-right:4px;"></i> ${candidate.name.split(' - ')[1] || 'Cập nhật từ hệ thống AI'}</div>
               </div>
           </div>
           <div class="job-tag">${candidate.position}</div>
           
           <div style="display: inline-block; padding: 6px 12px; border-radius: 6px; border: 1px solid ${badgeColor}; background: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 800; letter-spacing: 0.5px; margin-top: 5px;">
               🤖 AI MATCH: ${candidate.aiScore}% | ${statusText}
           </div>
   
           <div style="margin-top: 15px; font-size: 12px; color: #9ca3af; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 12px; line-height: 1.5;">
               <strong style="color:#e5e7eb;">Đánh giá AI:</strong> ${candidate.aiReason}
           </div>
       `;
       
       const columnBody = document.querySelector(`#${candidate.status} .column-body`);
       if(columnBody) columnBody.appendChild(card);
   }
   
   // 4. ĐẾM SỐ LƯỢNG KÈM HIỆU ỨNG POP ANIMATION
   function updateCounts() {
       // ĐÃ BỔ SUNG COL-REJECTED VÀO ĐÂY ĐỂ HỆ THỐNG ĐẾM
       ['col-new', 'col-screening', 'col-interview', 'col-hired', 'col-rejected'].forEach(colId => {
           const count = candidates.filter(c => c.status === colId).length;
           const countEl = document.getElementById(`count-${colId.split('-')[1]}`);
           
           if (countEl) {
               if (parseInt(countEl.innerText) !== count) {
                   countEl.innerText = count;
                   countEl.style.animation = 'none';
                   countEl.offsetHeight; 
                   countEl.style.animation = 'pop 0.3s ease';
               } else {
                   countEl.innerText = count;
               }
           }
       });
   }
   
   const style = document.createElement('style');
   style.innerHTML = `@keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.4); } 100% { transform: scale(1); } }`;
   document.head.appendChild(style);
   
   // 5. LOGIC KÉO THẢ TỐI ƯU DOM
   function setupDragAndDrop() {
       document.querySelectorAll('.kanban-column').forEach(col => {
           col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
           col.addEventListener('dragleave', e => { col.classList.remove('drag-over'); });
           col.addEventListener('drop', e => {
               e.preventDefault();
               col.classList.remove('drag-over');
               
               const cardId = e.dataTransfer.getData("text");
               const draggedCard = document.getElementById(cardId);
               const targetBody = col.querySelector('.column-body');
               
               if (draggedCard && targetBody) {
                   const newStatus = col.id;
                   const candidateIndex = candidates.findIndex(c => c.id === cardId);
                   
                   if(candidateIndex !== -1 && candidates[candidateIndex].status !== newStatus) {
                       candidates[candidateIndex].status = newStatus;
                       savedStatuses[cardId] = newStatus; 
                       saveColumnState();
                       
                       targetBody.appendChild(draggedCard);
                       updateCounts();
   
                       if (newStatus === 'col-hired') triggerConfetti();
                   }
               }
           });
       });
   }
   
   // 6. TÌM KIẾM THÔNG MINH
   function filterCandidates() {
       const searchInput = document.getElementById('search-cand');
       if(!searchInput) return;
       
       let input = searchInput.value.toLowerCase();
       document.querySelectorAll('.candidate-card').forEach(card => {
           let name = card.querySelector('.candidate-name').innerText.toLowerCase();
           let job = card.querySelector('.job-tag').innerText.toLowerCase();
           card.style.display = (name.includes(input) || job.includes(input)) ? "block" : "none";
       });
   }
   
   // 7. HIỆU ỨNG PHÁO HOA TUNG TÓE
   function triggerConfetti() {
       if (typeof confetti !== 'undefined') {
           const duration = 2500; const end = Date.now() + duration;
           (function frame() {
               confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#D4AF37', '#FFDF00', '#ffffff'] });
               confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#D4AF37', '#FFDF00', '#ffffff'] });
               if (Date.now() < end) requestAnimationFrame(frame);
           }());
       }
   }
   
   document.addEventListener("DOMContentLoaded", () => {
       if(document.querySelector('.kanban-board')) fetchCandidatesFromBackend();
   });
   
   // ========================================================
   // 8. TÍNH NĂNG XEM CHI TIẾT CV (MODAL VIEW)
   // ========================================================
   function openCvModal(candidateId) {
       const cand = candidates.find(c => c.id === candidateId);
       if (!cand) return;
   
       // Đổ dữ liệu Header
       document.getElementById('md-avatar').innerText = getInitials(cand.name);
       document.getElementById('md-name').innerText = cand.name.split(' - ')[0];
       document.getElementById('md-pos').innerText = cand.position;
       
       const scoreEl = document.getElementById('md-score');
       scoreEl.innerText = cand.aiScore + '%';
       scoreEl.style.color = cand.isPass ? '#10b981' : '#e74c3c';
       scoreEl.style.borderColor = cand.isPass ? 'rgba(16, 185, 129, 0.3)' : 'rgba(231, 76, 60, 0.3)';
       scoreEl.style.background = cand.isPass ? 'rgba(16, 185, 129, 0.1)' : 'rgba(231, 76, 60, 0.1)';
   
       document.getElementById('md-reason').innerText = cand.aiReason;
   
       // Đổ PDF iframe
       const cvFrame = document.getElementById('md-cv-frame');
       const cvLink = document.getElementById('md-cv-link');
       
       if (cand.cvUrl) {
           cvFrame.src = cand.cvUrl;
           cvLink.href = cand.cvUrl;
           cvLink.style.display = 'block';
       } else {
           cvFrame.src = '';
           cvLink.style.display = 'none';
       }
   
       // AI Giả lập phân tích SWOT
       let strengths = [];
       let weaknesses = [];
       
       if (cand.aiScore >= 80) {
           strengths = ["Kinh nghiệm hoàn toàn phù hợp với yêu cầu vị trí.", "Kỹ năng chuyên môn sâu, có khả năng làm việc độc lập.", "Trình bày CV chuyên nghiệp, rõ ràng."];
           weaknesses = ["Mức lương mong muốn có thể cao hơn ngân sách.", "Cần kiểm tra thêm kỹ năng làm việc nhóm qua phỏng vấn."];
       } else if (cand.aiScore >= 50) {
           strengths = ["Có kiến thức nền tảng tốt.", "Thái độ học hỏi và cầu tiến."];
           weaknesses = ["Chưa có nhiều kinh nghiệm thực chiến ở vị trí tương đương.", "Một số kỹ năng công cụ cần đào tạo thêm."];
       } else {
           strengths = ["Có sự quan tâm đến vị trí ứng tuyển."];
           weaknesses = ["Kinh nghiệm không liên quan đến ngành nghề.", "Thiếu các từ khóa chuyên môn quan trọng trong CV."];
       }
   
       document.getElementById('md-strengths').innerHTML = strengths.map(s => `<li>${s}</li>`).join('');
       document.getElementById('md-weaknesses').innerHTML = weaknesses.map(w => `<li>${w}</li>`).join('');
   
       // Bật Popup lên
       const modal = document.getElementById('cvModalOverlay');
       modal.style.display = 'flex';
       setTimeout(() => modal.classList.add('active'), 10);
   }
   
   function closeCvModal() {
       const modal = document.getElementById('cvModalOverlay');
       modal.classList.remove('active');
       setTimeout(() => {
           modal.style.display = 'none';
           // Tắt iframe để tránh rò rỉ bộ nhớ
           document.getElementById('md-cv-frame').src = '';
       }, 300);
   }
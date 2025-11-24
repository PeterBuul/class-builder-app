import React, { useState, useEffect } from 'react';
import XLSX from 'xlsx-js-style';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function App() {
  const [students, setStudents] = useState([]);
  
  // Parameters
  const [yearLevelsInput, setYearLevelsInput] = useState('7');
  const [totalClassesInput, setTotalClassesInput] = useState(0);
  const [compositeClassesInput, setCompositeClassesInput] = useState(0);
  const [classSizeRange, setClassSizeRange] = useState({ min: 20, max: 30 });
  
  // Logic
  const [friendRequests, setFriendRequests] = useState([]);
  const [separationRequests, setSeparationRequests] = useState([]);
  const [generatedClasses, setGeneratedClasses] = useState({});
  const [notification, setNotification] = useState('');

  const academicOrder = ['High', 'Average', 'Low', 'Unknown'];
  const behaviourOrder = ['High', 'Average', 'Low', 'Needs Support', 'Excellent', 'Good', 'Unknown'];

  // --- DATA PARSING ---
  useEffect(() => {
    const newFriendRequests = [];
    const newSeparationRequests = [];

    const findStudentFullName = (partialName, allStudents) => {
      if (!partialName) return null;
      const pName = partialName.toLowerCase().trim();
      let match = allStudents.find(s => s.fullName.toLowerCase() === pName);
      if (match) return match.fullName;
      match = allStudents.find(s => s.fullName.toLowerCase().startsWith(pName));
      return match ? match.fullName : null;
    };

    students.forEach(student => {
      if (student.requestPair) {
        const friend = findStudentFullName(student.requestPair, students);
        if (friend && student.fullName !== friend && !newFriendRequests.some(r => r.students.includes(student.fullName) && r.students.includes(friend))) {
          newFriendRequests.push({ students: [student.fullName, friend] });
        }
      }
      if (student.requestSeparate) {
        const separate = findStudentFullName(student.requestSeparate, students);
        if (separate && student.fullName !== separate && !newSeparationRequests.some(r => r.students.includes(student.fullName) && r.students.includes(separate))) {
          newSeparationRequests.push({ students: [student.fullName, separate] });
        }
      }
    });
    setFriendRequests(newFriendRequests);
    setSeparationRequests(newSeparationRequests);
  }, [students]);

  // --- HELPERS ---
  const normalizeRanking = (input) => {
    const val = String(input).toLowerCase().trim();
    if (['low', '1', 'below'].includes(val)) return 'Low';
    if (['at', '2', 'medium', 'average'].includes(val)) return 'Average';
    if (['above', '3', 'high'].includes(val)) return 'High';
    if (['excellent'].includes(val)) return 'Excellent';
    if (['good'].includes(val)) return 'Good';
    if (['needs support'].includes(val)) return 'Needs Support';
    return val === '' ? 'Unknown' : val.charAt(0).toUpperCase() + val.slice(1);
  };

  const handleStudentNamesInput = (e) => {
    const rows = e.target.value.split('\n').filter(r => r.trim() !== '');
    const header = rows[0].split('\t');
    const dataRows = (header.includes('Surname') || header.includes('Class') ? rows.slice(1) : rows).map(r => r.split('\t'));

    const parsed = dataRows.map((row, index) => {
      const fullName = `${row[2] || ''} ${row[1] || ''}`.trim();
      return {
        id: `student-${Date.now()}-${index}-${Math.random()}`, 
        firstName: row[2] || '',
        surname: row[1] || '',
        fullName: fullName || `Student ${index + 1}`,
        existingClass: row[0] || 'Unknown',
        gender: row[3] || 'Unknown',
        academic: normalizeRanking(row[4] || 'Average'),
        behaviour: normalizeRanking(row[5] || 'Good'),
        requestPair: row[6] || '',
        requestSeparate: row[7] || '',
      };
    }).filter(s => s.fullName !== 'Student');
    setStudents(parsed);
  };

  const handleClassSizeChange = (field, value) => {
    setClassSizeRange(prev => ({ ...prev, [field]: parseInt(value, 10) || 0 }));
  };

  const updateClassStats = (cls) => {
    cls.stats = { gender: {}, academic: {}, behaviour: {}, existingClass: {} };
    cls.students.forEach(s => {
      ['gender', 'academic', 'behaviour', 'existingClass'].forEach(k => cls.stats[k][s[k]||'Unknown'] = (cls.stats[k][s[k]||'Unknown']||0)+1);
    });
  };

  // --- CORE LOGIC: EQUAL SIZES + BALANCE ---
  const runBalancing = (pool, count) => {
    if (count <= 0 || !pool.length) return [[], []];
    
    const classes = Array.from({ length: count }, () => ({ students: [], stats: {} }));
    classes.forEach(c => updateClassStats(c));
    const placedIds = [];

    const getCost = (student, cls) => {
      // 1. HARD RULES
      if (cls.students.length >= classSizeRange.max) return 1000000;
      if (separationRequests.some(req => req.students.includes(student.fullName) && cls.students.some(p => req.students.includes(p.fullName)))) return 1000000;

      let cost = 0;
      
      // 2. EQUAL SIZE RULE (Water Filling)
      const minSize = Math.min(...classes.map(c => c.students.length));
      if (cls.students.length > minSize) cost += 5000;

      // 3. BALANCE RULES
      const factors = [{k:'academic',w:3}, {k:'behaviour',w:3}, {k:'gender',w:2}];
      factors.forEach(({k, w}) => {
        const total = pool.filter(s => s[k] === student[k]).length;
        const target = total / count;
        const curr = cls.stats[k][student[k]] || 0;
        cost += Math.pow(curr + 1 - target, 2) * w;
      });

      return cost;
    };

    // Place Friends
    friendRequests.forEach(req => {
      const [n1, n2] = req.students;
      const s1 = pool.find(s => s.fullName === n1 && !placedIds.includes(s.id));
      const s2 = pool.find(s => s.fullName === n2 && !placedIds.includes(s.id));
      if (s1 && s2) {
        classes.sort((a,b) => a.students.length - b.students.length);
        if (classes[0].students.length + 2 <= classSizeRange.max) {
           classes[0].students.push(s1, s2);
           updateClassStats(classes[0]);
           placedIds.push(s1.id, s2.id);
        }
      }
    });

    // Place Remaining
    let remaining = pool.filter(s => !placedIds.includes(s.id));
    for (let i = remaining.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [remaining[i], remaining[j]] = [remaining[j], remaining[i]]; }

    remaining.forEach(student => {
       let bestC = null, minCost = Infinity;
       // Shuffle classes to prevent left-to-right bias
       const shuffledClasses = [...classes].sort(() => Math.random() - 0.5);
       
       shuffledClasses.forEach(cls => {
          const cost = getCost(student, cls);
          if (cost < minCost) { minCost = cost; bestC = cls; }
       });

       if (bestC && minCost < 900000) {
         bestC.students.push(student);
         updateClassStats(bestC);
         placedIds.push(student.id);
       } else {
         // Emergency Fallback
         const fallback = classes.sort((a,b) => a.students.length - b.students.length)[0];
         fallback.students.push(student);
         updateClassStats(fallback);
         placedIds.push(student.id);
       }
    });

    return [classes, placedIds];
  };

  const generateClasses = () => {
    const years = yearLevelsInput.split(',').map(s => s.trim()).filter(Boolean);
    const numStraight = totalClassesInput - compositeClassesInput;
    if (totalClassesInput <= 0 || !years.length) { setGeneratedClasses({}); return; }

    const final = {};
    const allPlacedIds = new Set();
    const groupPool = students.filter(s => years.some(y => s.existingClass.startsWith(y)));

    const straightPools = {};
    const straightCounts = {};
    let totalCount = 0;
    
    years.forEach(y => {
      straightPools[y] = groupPool.filter(s => s.existingClass.startsWith(y));
      straightCounts[y] = straightPools[y].length;
      totalCount += straightPools[y].length;
    });

    let straightCreated = 0;
    years.forEach((y, i) => {
       if (!straightCounts[y]) return;
       let n = (i === years.length - 1) ? numStraight - straightCreated : Math.round((straightCounts[y]/totalCount) * numStraight);
       if (numStraight <= 0) n = 0;
       
       const [cls, ids] = runBalancing(straightPools[y], n);
       if (cls.length) final[`Straight Year ${parseInt(y)+1}`] = cls;
       ids.forEach(id => allPlacedIds.add(id));
       straightCreated += n;
    });

    const compPool = groupPool.filter(s => !allPlacedIds.has(s.id));
    const [compCls] = runBalancing(compPool, compositeClassesInput);
    if (compCls.length) final[`Composite ${years.map(y=>parseInt(y)+1).join('/')}`] = compCls;
    
    setGeneratedClasses(final);
  };

  // --- DRAG & DROP ---
  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    const [sGroup, sIdx] = source.droppableId.split('::');
    const [dGroup, dIdx] = destination.droppableId.split('::');

    const newGen = { ...generatedClasses };
    const srcList = newGen[sGroup][sIdx].students;
    const destList = newGen[dGroup][dIdx].students;
    const [moved] = srcList.splice(source.index, 1);
    destList.splice(destination.index, 0, moved);

    updateClassStats(newGen[sGroup][sIdx]);
    updateClassStats(newGen[dGroup][dIdx]);
    setGeneratedClasses(newGen);
  };

  // --- EXPORT ---
  const getHighlight = (name, list) => {
     if (friendRequests.some(req => req.students.includes(name) && list.some(s => req.students.includes(s.fullName) && s.fullName !== name))) return "text-green-700 font-bold";
     if (separationRequests.some(req => req.students.includes(name))) return "text-red-600 font-bold";
     return "";
  };

  const exportToXLSX = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [];
    const headerRow = [], subHeaderRow = [], colWidths = [];
    const allFlat = [];
    let maxLen = 0;

    Object.keys(generatedClasses).forEach(grp => {
       generatedClasses[grp].forEach((cls, i) => {
         allFlat.push({ ...cls, title: `${grp} - Class ${i+1}` });
         if (cls.students.length > maxLen) maxLen = cls.students.length;
       });
    });

    if (!allFlat.length) return;

    let cIdx = 0;
    allFlat.forEach(cls => {
       headerRow[cIdx] = `${cls.title} (${cls.students.length})`;
       subHeaderRow[cIdx] = "Name"; subHeaderRow[cIdx+1] = "Old"; subHeaderRow[cIdx+2] = "Acad"; subHeaderRow[cIdx+3] = "Beh";
       colWidths.push({wch:30},{wch:10},{wch:10},{wch:10},{wch:5});
       cIdx += 5;
    });

    wsData.push(headerRow, subHeaderRow);

    // Data
    allFlat.forEach(c => c.students.sort((a,b) => a.surname.localeCompare(b.surname)));
    for (let i=0; i<maxLen; i++) {
       const row = [];
       cIdx = 0;
       allFlat.forEach(cls => {
          const s = cls.students[i];
          if (s) { row[cIdx] = s.fullName; row[cIdx+1] = s.existingClass; row[cIdx+2] = s.academic; row[cIdx+3] = s.behaviour; }
          cIdx += 5;
       });
       wsData.push(row);
    }

    // Stats
    wsData.push([]); 
    const statsStart = wsData.length;
    const tRow=[], gRow=[], aRow=[], bRow=[], pRow=[];
    cIdx = 0;
    allFlat.forEach(cls => {
      tRow[cIdx] = "--- Class Balance ---";
      gRow[cIdx] = "Gender:"; gRow[cIdx+1] = Object.entries(cls.stats.gender).map(([k,v])=>`${k}:${v}`).join(', ');
      aRow[cIdx] = "Academic:"; aRow[cIdx+1] = academicOrder.map(l=>cls.stats.academic[l]?`${l}:${cls.stats.academic[l]}`:null).filter(Boolean).join(', ');
      bRow[cIdx] = "Behaviour:"; bRow[cIdx+1] = behaviourOrder.map(l=>cls.stats.behaviour[l]?`${l}:${cls.stats.behaviour[l]}`:null).filter(Boolean).join(', ');
      pRow[cIdx] = "Previous:"; pRow[cIdx+1] = Object.entries(cls.stats.existingClass).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).map(([k,v])=>`${k}:${v}`).join(', ');
      cIdx += 5;
    });
    wsData.push(tRow, gRow, aRow, bRow, pRow);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Styles
    const green = { fill: { fgColor: { rgb: "C6EFCE" } }, font: { bold: true } };
    const red = { fill: { fgColor: { rgb: "FFC7CE" } }, font: { bold: true } };

    for (let r=2; r<maxLen+2; r++) {
       cIdx = 0;
       allFlat.forEach(cls => {
          const s = cls.students[r-2];
          if (s) {
             let style = null;
             if (friendRequests.some(req => req.students.includes(s.fullName) && cls.students.some(p => req.students.includes(p.fullName) && p.fullName !== s.fullName))) style = green;
             if (separationRequests.some(req => req.students.includes(s.fullName))) style = red;
             
             if (style) {
               for(let k=0; k<4; k++) {
                 const ref = XLSX.utils.encode_cell({r, c: cIdx+k});
                 if (!ws[ref]) ws[ref] = {v:wsData[r][cIdx+k]||"", t:'s'};
                 ws[ref].s = style;
               }
             }
          }
          cIdx += 5;
       });
    }
    ws['!cols'] = colWidths;
    
    // Merges
    ws['!merges'] = [];
    cIdx = 0;
    allFlat.forEach(() => {
       ws['!merges'].push({s:{r:0,c:cIdx}, e:{r:0,c:cIdx+3}});
       ws['!merges'].push({s:{r:statsStart,c:cIdx}, e:{r:statsStart,c:cIdx+3}});
       for(let m=1; m<=4; m++) ws['!merges'].push({s:{r:statsStart+m,c:cIdx+1}, e:{r:statsStart+m,c:cIdx+3}});
       cIdx += 5;
    });

    XLSX.utils.book_append_sheet(wb, ws, "Classes");
    XLSX.writeFile(wb, "Generated_Classes.xlsx");
  };

  // --- TEMPLATES ---
  const downloadTemplate = () => {
    const headers = "Class,Surname,First Name,Gender,Academic,Behaviour Needs,Request: Pair,Request: Separate";
    const csvContent = "data:text/csv;charset=utf-8," + [headers, "4A,Smith,Jane,Female,High,Good,John Doe,Tom Lee"].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "student_template.csv";
    link.click();
  };

  // --- HELPERS ---
  const saveProgress = () => {
    localStorage.setItem('classBuilderSave', JSON.stringify({ students, yearLevelsInput, totalClassesInput, compositeClassesInput, generatedClasses }));
    setNotification('Saved!');
    setTimeout(()=>setNotification(''), 2000);
  };
  
  const loadProgress = () => {
    const d = JSON.parse(localStorage.getItem('classBuilderSave'));
    if(d) { setStudents(d.students); setYearLevelsInput(d.yearLevelsInput); setGeneratedClasses(d.generatedClasses); }
  };

  return (
    <div className="container mx-auto p-4 font-sans">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Class Builder App</h1>
        <p className="text-xl text-gray-600">Making building classes as easy as 1,2...3</p>
      </div>
      {notification && <div className="fixed top-4 right-4 bg-blue-100 border-blue-500 p-4 shadow">{notification}</div>}

      <div className="flex gap-4 mb-6 justify-center">
         <button onClick={saveProgress} className="bg-indigo-600 text-white font-bold py-2 px-6 rounded">Save Progress</button>
         <button onClick={loadProgress} className="bg-gray-600 text-white font-bold py-2 px-6 rounded">Load Progress</button>
         <button onClick={downloadTemplate} className="bg-gray-500 text-white font-bold py-2 px-6 rounded">Download Template</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
         <div className="bg-white p-6 rounded shadow">
            <label className="block font-bold mb-2">Paste Data:</label>
            <textarea className="w-full border p-2 h-32" onChange={handleStudentNamesInput} placeholder="Paste here..."></textarea>
         </div>
         <div className="bg-white p-6 rounded shadow">
            <h2 className="font-bold mb-4">Parameters</h2>
            <div className="mb-2"><label>Current Years:</label><input className="border w-full p-2" value={yearLevelsInput} onChange={e=>setYearLevelsInput(e.target.value)}/></div>
            <div className="flex gap-2 mb-2">
               <div><label>Total Classes:</label><input type="number" className="border w-full p-2" value={totalClassesInput} onChange={e=>setTotalClassesInput(parseInt(e.target.value)||0)}/></div>
               <div><label>Composite:</label><input type="number" className="border w-full p-2" value={compositeClassesInput} onChange={e=>setCompositeClassesInput(parseInt(e.target.value)||0)}/></div>
            </div>
            <div className="flex gap-2">
               <input type="number" className="border w-full p-2" placeholder="Min Size" value={classSizeRange.min} onChange={e=>handleClassSizeChange('min', e.target.value)}/>
               <input type="number" className="border w-full p-2" placeholder="Max Size" value={classSizeRange.max} onChange={e=>handleClassSizeChange('max', e.target.value)}/>
            </div>
         </div>
      </div>

      <button onClick={generateClasses} className="bg-green-500 text-white font-bold w-full py-3 rounded mb-8 text-xl">Generate Classes</button>

      <DragDropContext onDragEnd={onDragEnd}>
         {Object.keys(generatedClasses).length > 0 && (
           <div className="bg-white p-6 rounded shadow">
              <div className="flex justify-between mb-4">
                 <h2 className="text-2xl font-bold">Results</h2>
                 <button onClick={exportToXLSX} className="bg-indigo-500 text-white font-bold py-2 px-4 rounded">Export Excel</button>
              </div>
              {Object.keys(generatedClasses).map(grp => (
                <div key={grp} className="mb-8">
                   <h3 className="font-bold text-xl mb-4">{grp}</h3>
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {generatedClasses[grp].map((cls, i) => (
                         <div key={i} className="border p-2 rounded bg-gray-50">
                            <h4 className="font-bold text-indigo-700">Class {i+1} ({cls.students.length})</h4>
                            <table className="w-full text-xs mt-2">
                               <thead><tr className="text-left text-gray-500"><th>Name</th><th>Old</th><th>Acad</th><th>Beh</th></tr></thead>
                               <Droppable droppableId={`${grp}::${i}`}>
                                  {(provided) => (
                                     <tbody ref={provided.innerRef} {...provided.droppableProps} className="bg-white">
                                        {cls.students.sort((a,b)=>a.surname.localeCompare(b.surname)).map((s, idx) => (
                                           <Draggable key={s.id} draggableId={s.id} index={idx}>
                                              {(p) => (
                                                 <tr ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={`border-b ${getHighlight(s.fullName, cls.students)}`}>
                                                    <td className="p-1">{s.fullName}</td><td className="p-1">{s.existingClass}</td><td className="p-1">{s.academic}</td><td className="p-1">{s.behaviour}</td>
                                                 </tr>
                                              )}
                                           </Draggable>
                                        ))}
                                        {provided.placeholder}
                                     </tbody>
                                  )}
                               </Droppable>
                            </table>
                            <div className="text-xs mt-2 pt-2 border-t">
                               <p><strong>Gender:</strong> {Object.entries(cls.stats.gender).map(([k,v])=>`${k}:${v}`).join(', ')}</p>
                               <p><strong>Acad:</strong> {academicOrder.map(k=>cls.stats.academic[k]?`${k}:${cls.stats.academic[k]}`:null).filter(Boolean).join(', ')}</p>
                               <p><strong>Beh:</strong> {behaviourOrder.map(k=>cls.stats.behaviour[k]?`${k}:${cls.stats.behaviour[k]}`:null).filter(Boolean).join(', ')}</p>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
              ))}
           </div>
         )}
      </DragDropContext>

      <div className="text-center text-gray-600 mt-12 p-4 border-t">
        <p className="font-semibold">Other apps charge thousands of dollars for this functionality.</p>
        <p className="mb-2">We're sure this saved you a lot of precious time and we just ask for a fair donation.</p>
        <p className="text-sm font-mono">Peter Buultjens</p>
        <p className="text-sm font-mono">BSB: 062-948</p>
        <p className="text-sm font-mono">Account: 2402 2276</p>
      </div>
    </div>
  );
}

export default App;

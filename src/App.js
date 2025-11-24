import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx-js-style';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function App() {
  const [students, setStudents] = useState([]);
  
  // Parameters
  const [yearLevelsInput, setYearLevelsInput] = useState('7');
  const [totalClassesInput, setTotalClassesInput] = useState(0);
  const [compositeClassesInput, setCompositeClassesInput] = useState(0);
  const [classSizeRange, setClassSizeRange] = useState({ min: 20, max: 30 });
  
  const [friendRequests, setFriendRequests] = useState([]);
  const [separationRequests, setSeparationRequests] = useState([]);
  const [generatedClasses, setGeneratedClasses] = useState({});
  const [notification, setNotification] = useState('');

  const academicOrder = ['High', 'Average', 'Low', 'Unknown'];
  const behaviourOrder = ['High', 'Average', 'Low', 'Needs Support', 'Excellent', 'Good', 'Unknown'];

  // --- NOTIFICATION ---
  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  // --- SAVE & LOAD ---
  const saveProgress = () => {
    const data = { students, yearLevelsInput, totalClassesInput, compositeClassesInput, classSizeRange, friendRequests, separationRequests, generatedClasses };
    localStorage.setItem('classBuilderSave', JSON.stringify(data));
    showNotification('Progress Saved!');
  };

  const loadProgress = () => {
    const data = localStorage.getItem('classBuilderSave');
    if (data) {
      const parsed = JSON.parse(data);
      setStudents(parsed.students || []);
      setYearLevelsInput(parsed.yearLevelsInput || '');
      setTotalClassesInput(parsed.totalClassesInput || 0);
      setCompositeClassesInput(parsed.compositeClassesInput || 0);
      setClassSizeRange(parsed.classSizeRange || { min: 20, max: 30 });
      setFriendRequests(parsed.friendRequests || []);
      setSeparationRequests(parsed.separationRequests || []);
      setGeneratedClasses(parsed.generatedClasses || {});
      showNotification('Progress Loaded!');
    }
  };

  // --- AUTO PARSE REQUESTS ---
  useEffect(() => {
    const newFriendRequests = [];
    const newSeparationRequests = [];
    const findName = (partial, list) => {
      if (!partial) return null;
      const p = partial.toLowerCase().trim();
      let m = list.find(s => s.fullName.toLowerCase() === p);
      if (m) return m.fullName;
      m = list.find(s => s.fullName.toLowerCase().startsWith(p));
      return m ? m.fullName : null;
    };

    students.forEach(s => {
      if (s.requestPair) {
        const f = findName(s.requestPair, students);
        if (f && s.fullName !== f && !newFriendRequests.some(r => r.students.includes(s.fullName) && r.students.includes(f))) {
          newFriendRequests.push({ students: [s.fullName, f] });
        }
      }
      if (s.requestSeparate) {
        const f = findName(s.requestSeparate, students);
        if (f && s.fullName !== f && !newSeparationRequests.some(r => r.students.includes(s.fullName) && r.students.includes(f))) {
          newSeparationRequests.push({ students: [s.fullName, f] });
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

  const downloadTemplate = () => {
    const headers = "Class,Surname,First Name,Gender,Academic,Behaviour Needs,Request: Pair,Request: Separate";
    const ex1 = "4A,Smith,Jane,Female,High,Good,John Doe,Tom Lee";
    const ex2 = "4B,Doe,John,Male,2,2,Jane S,";
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ex1, ex2].join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "student_template.csv";
    link.click();
  };

  const updateClassStats = (cls) => {
    cls.stats = { gender: {}, academic: {}, behaviour: {}, existingClass: {} };
    cls.students.forEach(s => {
      ['gender', 'academic', 'behaviour', 'existingClass'].forEach(cat => {
        const val = s[cat] || 'Unknown';
        cls.stats[cat][val] = (cls.stats[cat][val] || 0) + 1;
      });
    });
  };

  // --- GENERATOR LOGIC ---
  const runBalancing = (pool, count) => {
    if (count <= 0 || !pool.length) return [[], []];
    
    const classes = Array.from({ length: count }, () => ({ students: [], stats: {} }));
    classes.forEach(c => updateClassStats(c));
    const placedIds = [];

    // Cost function
    const getPlacementCost = (student, cls) => {
      if (cls.students.length >= classSizeRange.max) return 1000000;
      if (separationRequests.some(req => req.students.includes(student.fullName) && cls.students.some(p => req.students.includes(p.fullName)))) return 1000000;

      let cost = 0;
      
      // WATER FILLING: Penalize if bigger than smallest class
      const minSize = Math.min(...classes.map(c => c.students.length));
      if (cls.students.length > minSize) cost += 5000;

      const factors = [
        { cat: 'academic', weight: 5 },
        { cat: 'behaviour', weight: 5 },
        { cat: 'gender', weight: 2 }
      ];

      factors.forEach(({ cat, weight }) => {
         const totalInPool = pool.filter(s => s[cat] === student[cat]).length;
         const target = totalInPool / count;
         const current = cls.stats[cat][student[cat]] || 0;
         cost += Math.pow(current + 1 - target, 2) * weight;
      });
      
      return cost;
    };

    // 1. Friends
    friendRequests.forEach(req => {
      const [n1, n2] = req.students;
      const s1 = pool.find(s => s.fullName === n1 && !placedIds.includes(s.id));
      const s2 = pool.find(s => s.fullName === n2 && !placedIds.includes(s.id));
      if (s1 && s2) {
        classes.sort((a,b) => a.students.length - b.students.length);
        const bestC = classes[0];
        if (bestC.students.length + 2 <= classSizeRange.max) {
           bestC.students.push(s1, s2);
           updateClassStats(bestC);
           placedIds.push(s1.id, s2.id);
        }
      }
    });

    // 2. Remaining
    let remaining = pool.filter(s => !placedIds.includes(s.id));
    for (let i = remaining.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [remaining[i], remaining[j]] = [remaining[j], remaining[i]]; }

    remaining.forEach(student => {
       let bestClass = null;
       let minCost = Infinity;

       // Shuffle classes to prevent bias
       const shuffledClasses = [...classes].sort(() => Math.random() - 0.5);

       shuffledClasses.forEach(cls => {
          const cost = getPlacementCost(student, cls);
          if (cost < minCost) { minCost = cost; bestClass = cls; }
       });

       if (bestClass && minCost < 900000) {
         bestClass.students.push(student);
         updateClassStats(bestClass);
         placedIds.push(student.id);
       } else {
         // Force fallback
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
    if (compCls.length) {
       final[`Composite ${years.map(y=>parseInt(y)+1).join('/')}`] = compCls;
    }
    
    setGeneratedClasses(final);
  };

  // --- DRAG AND DROP ---
  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    const [sGroup, sIdx] = source.droppableId.split('::');
    const [dGroup, dIdx] = destination.droppableId.split('::');

    const newGen = { ...generatedClasses };
    const sourceList = newGen[sGroup][sIdx].students;
    const destList = newGen[dGroup][dIdx].students;
    const [moved] = sourceList.splice(source.index, 1);
    destList.splice(destination.index, 0, moved);

    updateClassStats(newGen[sGroup][sIdx]);
    updateClassStats(newGen[dGroup][dIdx]);
    setGeneratedClasses(newGen);
  };

  // --- EXPORT ---
  const exportToXLSX = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [];
    const headerRow = [];
    const subHeaderRow = [];
    const colWidths = [];

    const allFlatClasses = [];
    let maxLen = 0;

    Object.keys(generatedClasses).forEach(grp => {
       generatedClasses[grp].forEach((cls, i) => {
         allFlatClasses.push({ ...cls, title: `${grp} - Class ${i+1}` });
         if (cls.students.length > maxLen) maxLen = cls.students.length;
       });
    });

    if (allFlatClasses.length === 0) return;

    let colIdx = 0;
    allFlatClasses.forEach(cls => {
       headerRow[colIdx] = `${cls.title} (${cls.students.length})`;
       subHeaderRow[colIdx] = "Name";
       subHeaderRow[colIdx+1] = "Old";
       subHeaderRow[colIdx+2] = "Acad";
       subHeaderRow[colIdx+3] = "Beh";
       colWidths.push({wch:30}, {wch:10}, {wch:10}, {wch:10}, {wch:5});
       colIdx += 5;
    });

    wsData.push(headerRow, subHeaderRow);

    // Sort & Populate
    allFlatClasses.forEach(c => c.students.sort((a,b) => a.surname.localeCompare(b.surname)));

    for (let i=0; i<maxLen; i++) {
       const row = [];
       colIdx = 0;
       allFlatClasses.forEach(cls => {
          const s = cls.students[i];
          if (s) {
             row[colIdx] = s.fullName;
             row[colIdx+1] = s.existingClass;
             row[colIdx+2] = s.academic;
             row[colIdx+3] = s.behaviour;
          }
          colIdx += 5;
       });
       wsData.push(row);
    }

    wsData.push([]);
    const statsStart = wsData.length;
    const tRow=[], gRow=[], aRow=[], bRow=[];
    colIdx = 0;
    
    allFlatClasses.forEach(cls => {
      tRow[colIdx] = "--- Class Balance ---";
      gRow[colIdx] = "Gender:"; gRow[colIdx+1] = Object.entries(cls.stats.gender).map(([k,v])=>`${k}:${v}`).join(', ');
      aRow[colIdx] = "Academic:"; aRow[colIdx+1] = academicOrder.map(l=>cls.stats.academic[l]?`${l}:${cls.stats.academic[l]}`:null).filter(Boolean).join(', ');
      bRow[colIdx] = "Behaviour:"; bRow[colIdx+1] = behaviourOrder.map(l=>cls.stats.behaviour[l]?`${l}:${cls.stats.behaviour[l]}`:null).filter(Boolean).join(', ');
      colIdx += 5;
    });
    wsData.push(tRow, gRow, aRow, bRow);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Styling
    const greenStyle = { fill: { fgColor: { rgb: "C6EFCE" } }, font: { bold: true } };
    const redStyle = { fill: { fgColor: { rgb: "FFC7CE" } }, font: { bold: true } };
    
    for (let r=2; r<maxLen+2; r++) {
       colIdx = 0;
       allFlatClasses.forEach(cls => {
          const s = cls.students[r-2];
          if (s) {
             let style = null;
             if (friendRequests.some(req => req.students.includes(s.fullName) && cls.students.some(p => req.students.includes(p.fullName) && p.fullName !== s.fullName))) style = greenStyle;
             if (separationRequests.some(req => req.students.includes(s.fullName))) style = redStyle;

             if (style) {
               for(let k=0; k<4; k++) {
                 const ref = XLSX.utils.encode_cell({r, c: colIdx+k});
                 if (!ws[ref]) ws[ref] = {v:wsData[r][colIdx+k]||"", t:'s'};
                 ws[ref].s = style;
               }
             }
          }
          colIdx += 5;
       });
    }
    
    ws['!cols'] = colWidths;
    ws['!merges'] = [];
    colIdx = 0;
    allFlatClasses.forEach(() => {
       ws['!merges'].push({s:{r:0, c:colIdx}, e:{r:0, c:colIdx+3}});
       ws['!merges'].push({s:{r:statsStart, c:colIdx}, e:{r:statsStart, c:colIdx+3}});
       ws['!merges'].push({s:{r:statsStart+1, c:colIdx+1}, e:{r:statsStart+1, c:colIdx+3}});
       ws['!merges'].push({s:{r:statsStart+2, c:colIdx+1}, e:{r:statsStart+2, c:colIdx+3}});
       ws['!merges'].push({s:{r:statsStart+3, c:colIdx+1}, e:{r:statsStart+3, c:colIdx+3}});
       colIdx += 5;
    });

    XLSX.utils.book_append_sheet(wb, ws, "Classes");
    XLSX.writeFile(wb, "Generated_Classes.xlsx");
  };

  const getHighlight = (name, list) => {
     if (friendRequests.some(req => req.students.includes(name) && list.some(s => req.students.includes(s.fullName) && s.fullName !== name))) return "text-green-700 font-bold";
     if (separationRequests.some(req => req.students.includes(name))) return "text-red-600 font-bold";
     return "";
  };

  return (
    <div className="container mx-auto p-4 font-sans">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2 text-gray-800">Class Builder App</h1>
        <p className="text-xl text-gray-600 mb-8">Making building classes as easy as 1,2...3</p>
      </div>
      {notification && <div className="fixed top-4 right-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 shadow-md z-50">{notification}</div>}
      
      <div className="flex gap-4 mb-6 justify-center">
         <button onClick={saveProgress} className="bg-indigo-600 hover:bg-indigo-800 text-white font-bold py-2 px-6 rounded shadow">Save Progress</button>
         <button onClick={loadProgress} className="bg-gray-600 hover:bg-gray-800 text-white font-bold py-2 px-6 rounded shadow">Load Progress</button>
      </div>
      <div className="mb-6 max-w-lg mx-auto">
          <button onClick={downloadTemplate} className="w-full bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Download CSV Template</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <label className="block text-gray-700 text-sm font-bold mb-2">Paste Tab-Separated Data (Template):</label>
          <textarea className="shadow border rounded w-full py-2 px-3 h-32" placeholder="Paste here..." onChange={handleStudentNamesInput}></textarea>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Class Parameters</h2>
          <div className="mb-2">
            <label className="block text-gray-700 text-sm font-bold">Current Year Levels (e.g. 4, 5)</label>
            <input type="text" value={yearLevelsInput} onChange={e => setYearLevelsInput(e.target.value)} className="shadow border rounded w-full py-2 px-3"/>
          </div>
          <div className="flex gap-4 mb-2">
             <div className="w-1/2"><label className="block text-gray-700 text-sm font-bold">Total Classes</label><input type="number" value={totalClassesInput} onChange={e => setTotalClassesInput(parseInt(e.target.value)||0)} className="shadow border rounded w-full py-2 px-3"/></div>
             <div className="w-1/2"><label className="block text-gray-700 text-sm font-bold">Composite</label><input type="number" value={compositeClassesInput} onChange={e => setCompositeClassesInput(parseInt(e.target.value)||0)} className="shadow border rounded w-full py-2 px-3"/></div>
          </div>
          <div className="flex gap-2">
             <input type="number" value={classSizeRange.min} onChange={e => handleClassSizeChange('min', e.target.value)} className="shadow border rounded w-1/2 py-2 px-3" placeholder="Min Size" />
             <input type="number" value={classSizeRange.max} onChange={e => handleClassSizeChange('max', e.target.value)} className="shadow border rounded w-1/2 py-2 px-3" placeholder="Max Size" />
          </div>
        </div>
      </div>
      <button onClick={generateClasses} className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-xl w-full mb-8">Generate Classes</button>

      <DragDropContext onDragEnd={onDragEnd}>
        {Object.keys(generatedClasses).length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-2xl font-bold">Generated Classes</h2>
               <button onClick={exportToXLSX} className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Export to .xlsx</button>
             </div>
             <p className="text-center text-gray-600 mb-6">Feel free to drag and drop if you want a change before you export.</p>
             {Object.keys(generatedClasses).map(grp => (
               <div key={grp} className="mb-8">
                 <h3 className="text-xl font-bold mb-4">{grp}</h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {generatedClasses[grp].map((cls, idx) => (
                     <div key={idx} className="border rounded-lg p-2 shadow-sm bg-gray-50">
                       <h4 className="font-bold text-indigo-700 mb-2">Class {idx+1} ({cls.students.length})</h4>
                       <table className="min-w-full text-xs">
                         <thead><tr className="text-left text-gray-500"><th>Name</th><th>Old</th><th>Acad</th><th>Beh</th></tr></thead>
                         <Droppable droppableId={`${grp}::${idx}`}>
                           {(provided) => (
                             <tbody ref={provided.innerRef} {...provided.droppableProps} className="bg-white">
                               {cls.students.sort((a,b) => a.surname.localeCompare(b.surname)).map((s, i) => (
                                 <Draggable key={s.id} draggableId={s.id} index={i}>
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
                          <p><strong>Academic:</strong> {academicOrder.map(k => cls.stats.academic[k]?`${k}:${cls.stats.academic[k]}`:null).filter(Boolean).join(', ')}</p>
                          <p><strong>Behaviour:</strong> {behaviourOrder.map(k => cls.stats.behaviour[k]?`${k}:${cls.stats.behaviour[k]}`:null).filter(Boolean).join(', ')}</p>
                          <p><strong>Previous Class:</strong> {Object.entries(cls.stats.existingClass).sort((a, b) => a[0].localeCompare(b[0], undefined, {numeric: true})).map(([k, v]) => `${k}: ${v}`).join(', ')}</p>
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

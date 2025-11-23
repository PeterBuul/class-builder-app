import React, { useState, useEffect } from 'react';
import XLSX from 'xlsx-js-style';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

function App() {
  const [students, setStudents] = useState([]);
  
  // Parameters state
  const [yearLevelsInput, setYearLevelsInput] = useState('7');
  const [totalClassesInput, setTotalClassesInput] = useState(0);
  const [compositeClassesInput, setCompositeClassesInput] = useState(0);
  const [classSizeRange, setClassSizeRange] = useState({ min: 20, max: 30 });
  
  const [friendRequests, setFriendRequests] = useState([]);
  const [separationRequests, setSeparationRequests] = useState([]);
  const [generatedClasses, setGeneratedClasses] = useState({});
  const [notification, setNotification] = useState('');

  // Define stat orders
  const academicOrder = ['High', 'Average', 'Low', 'Unknown'];
  const behaviourOrder = ['High', 'Average', 'Low', 'Needs Support', 'Excellent', 'Good', 'Unknown'];

  // --- SAVE & LOAD ---
  const saveProgress = () => {
    const data = { students, yearLevelsInput, totalClassesInput, compositeClassesInput, classSizeRange, friendRequests, separationRequests, generatedClasses };
    localStorage.setItem('classBuilderSave', JSON.stringify(data));
    setNotification('Progress Saved!');
    setTimeout(() => setNotification(''), 3000);
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
      setNotification('Progress Loaded!');
      setTimeout(() => setNotification(''), 3000);
    }
  };

  // Auto-parse requests
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

  const parseStudentData = (data) => {
    return data.map((row, index) => {
      const fullName = `${row['First Name'] || ''} ${row.Surname || ''}`.trim();
      return {
        id: `student-${Date.now()}-${index}-${Math.random()}`, 
        firstName: row['First Name'] || '',
        surname: row.Surname || '',
        fullName: fullName || `Student ${index + 1}`,
        existingClass: row.Class || 'Unknown',
        gender: row.Gender || 'Unknown',
        academic: normalizeRanking(row.Academic || 'Average'),
        behaviour: normalizeRanking(row['Behaviour Needs'] || 'Good'),
        requestPair: row['Request: Pair'] || '',
        requestSeparate: row['Request: Separate'] || '',
      };
    }).filter(s => s.fullName !== 'Student');
  };

  const handleStudentNamesInput = (e) => {
    const rows = e.target.value.split('\n').filter(r => r.trim() !== '');
    const header = rows[0].split('\t');
    const dataRows = (header.includes('Surname') || header.includes('Class') ? rows.slice(1) : rows).map(r => r.split('\t'));
    const dataObjects = dataRows.map(row => ({
      'Class': row[0], 'Surname': row[1], 'First Name': row[2], 'Gender': row[3],
      'Academic': row[4], 'Behaviour Needs': row[5], 'Request: Pair': row[6], 'Request: Separate': row[7],
    }));
    setStudents(parseStudentData(dataObjects));
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

  // --- EXPORT LOGIC ---
  const exportToXLSX = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [];
    const headerRow = [];
    const subHeaderRow = [];
    const colWidths = [];

    const allclasses = [];
    const groupNames = Object.keys(generatedClasses);
    let maxLen = 0;
    
    groupNames.forEach(groupName => {
      generatedClasses[groupName].forEach((cls, index) => {
        allclasses.push({ ...cls, groupName, classIndex: index + 1 });
        if (cls.students.length > maxLen) maxLen = cls.students.length;
      });
    });

    if (allclasses.length === 0) { alert("No classes to export."); return; }
    
    let colIndex = 0;
    allclasses.forEach((cls) => {
      headerRow[colIndex] = `${cls.groupName} - Class ${cls.classIndex} (${cls.students.length})`;
      subHeaderRow[colIndex] = 'Student Name';
      subHeaderRow[colIndex+1] = 'Old Class';
      subHeaderRow[colIndex+2] = 'Academic';
      subHeaderRow[colIndex+3] = 'Behaviour';
      colWidths.push({wch: 30}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 5});
      colIndex += 5;
    });
    
    wsData.push(headerRow, subHeaderRow);

    const sortedAllClasses = allclasses.map(cls => ({
      ...cls,
      students: cls.students.sort((a,b) => a.surname.localeCompare(b.surname))
    }));
    
    for (let i = 0; i < maxLen; i++) {
      const row = [];
      colIndex = 0;
      for (let c = 0; c < sortedAllClasses.length; c++) {
        const s = sortedAllClasses[c].students[i];
        if (s) {
          row[colIndex] = s.fullName;
          row[colIndex+1] = s.existingClass;
          row[colIndex+2] = s.academic;
          row[colIndex+3] = s.behaviour;
        }
        colIndex += 5;
      }
      wsData.push(row);
    }
    
    wsData.push([]); 
    const statsStart = wsData.length;
    const tRow = [], gRow = [], aRow = [], bRow = [];
    colIndex = 0;
    allclasses.forEach((cls) => {
      tRow[colIndex] = "--- Class Balance ---";
      gRow[colIndex] = "Gender:"; gRow[colIndex+1] = Object.entries(cls.stats.gender).map(([k,v])=>`${k}:${v}`).join(', ');
      aRow[colIndex] = "Academic:"; aRow[colIndex+1] = academicOrder.map(l => cls.stats.academic[l] ? `${l}:${cls.stats.academic[l]}` : null).filter(Boolean).join(', ');
      bRow[colIndex] = "Behaviour:"; bRow[colIndex+1] = behaviourOrder.map(l => cls.stats.behaviour[l] ? `${l}:${cls.stats.behaviour[l]}` : null).filter(Boolean).join(', ');
      colIndex += 5;
    });
    wsData.push(tRow, gRow, aRow, bRow);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    const greenStyle = { fill: { fgColor: { rgb: "C6EFCE" } }, font: { bold: true } }; 
    const redStyle = { fill: { fgColor: { rgb: "FFC7CE" } }, font: { bold: true } };   

    for (let r = 2; r < maxLen + 2; r++) {
      colIndex = 0;
      for (let c = 0; c < sortedAllClasses.length; c++) {
        const s = sortedAllClasses[c].students[r-2];
        if (s) {
           let style = null;
           if (friendRequests.some(req => req.students.includes(s.fullName) && sortedAllClasses[c].students.some(p => req.students.includes(p.fullName) && p.fullName !== s.fullName))) {
             style = greenStyle;
           }
           if (separationRequests.some(req => req.students.includes(s.fullName))) {
             style = redStyle;
           }

           if (style) {
             for(let k=0; k<4; k++) {
               const ref = XLSX.utils.encode_cell({r, c: colIndex + k});
               if(!ws[ref]) ws[ref] = {v: wsData[r][colIndex+k], t:'s'};
               ws[ref].s = style;
             }
           }
        }
        colIndex += 5;
      }
    }
    
    ws['!cols'] = colWidths;
    ws['!merges'] = [];
    colIndex = 0;
    for (let c = 0; c < allclasses.length; c++) {
       ws['!merges'].push({ s: { r: 0, c: colIndex }, e: { r: 0, c: colIndex + 3 } }); 
       ws['!merges'].push({ s: { r: statsStart, c: colIndex }, e: { r: statsStart, c: colIndex + 3 } }); 
       ws['!merges'].push({ s: { r: statsStart+1, c: colIndex+1 }, e: { r: statsStart+1, c: colIndex+3 } }); 
       ws['!merges'].push({ s: { r: statsStart+2, c: colIndex+1 }, e: { r: statsStart+2, c: colIndex+3 } }); 
       ws['!merges'].push({ s: { r: statsStart+3, c: colIndex+1 }, e: { r: statsStart+3, c: colIndex+3 } }); 
       colIndex += 5;
    }

    XLSX.utils.book_append_sheet(wb, ws, "Classes");
    XLSX.writeFile(wb, "Generated_Classes.xlsx");
  };

  // --- GENERATION LOGIC ---
  const runBalancing = (pool, count) => {
    if (count <= 0 || !pool.length) return [[], []];
    const placedIds = [];
    const classes = Array.from({ length: count }, () => ({
      students: [], stats: { gender: {}, academic: {}, behaviour: {}, existingClass: {} }
    }));

    const groupTotals = { academic: {}, behaviour: {}, gender: {}, existingClass: {} };
    pool.forEach(s => ['academic', 'behaviour', 'gender', 'existingClass'].forEach(k => groupTotals[k][s[k]||'Unknown'] = (groupTotals[k][s[k]||'Unknown']||0)+1));

    const updateStats = (c, s) => ['academic', 'behaviour', 'gender', 'existingClass'].forEach(k => c.stats[k][s[k]||'Unknown'] = (c.stats[k][s[k]||'Unknown']||0)+1);
    
    const calcCost = (s, c) => {
       if (c.students.length >= classSizeRange.max) return 100000;
       if (separationRequests.some(req => req.students.includes(s.fullName) && c.students.some(p => req.students.includes(p.fullName)))) return 100000;
       let cost = 0;
       ['academic', 'behaviour', 'gender'].forEach(cat => {
          const total = groupTotals[cat][s[cat]] || 0;
          const avg = total / count;
          const curr = c.stats[cat][s[cat]] || 0;
          cost += Math.pow(curr + 1 - avg, 2) * (cat === 'academic' || cat === 'behaviour' ? 3 : 2);
       });
       return cost;
    };

    friendRequests.forEach(req => {
      const [n1, n2] = req.students;
      const s1 = pool.find(s => s.fullName === n1 && !placedIds.includes(s.id));
      const s2 = pool.find(s => s.fullName === n2 && !placedIds.includes(s.id));
      if (s1 && s2) {
         classes.sort((a,b) => a.students.length - b.students.length);
         if (classes[0].students.length + 2 <= classSizeRange.max) {
            classes[0].students.push(s1, s2);
            updateStats(classes[0], s1); updateStats(classes[0], s2);
            placedIds.push(s1.id, s2.id);
         }
      }
    });

    let remaining = pool.filter(s => !placedIds.includes(s.id));
    for (let i = remaining.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [remaining[i], remaining[j]] = [remaining[j], remaining[i]]; }

    remaining.forEach(s => {
       let bestC = null, minCost = Infinity;
       classes.sort(() => Math.random() - 0.5).forEach(c => {
          const cost = calcCost(s, c);
          if (cost < minCost) { minCost = cost; bestC = c; }
       });
       if (bestC && minCost < 100000) {
          bestC.students.push(s); updateStats(bestC, s); placedIds.push(s.id);
       } else {
          const fallback = classes.sort((a,b) => a.students.length - b.students.length).find(c => c.students.length < classSizeRange.max) || classes[0];
          fallback.students.push(s); updateStats(fallback, s); placedIds.push(s.id);
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
    let totalStraightCount = 0;
    
    years.forEach(y => {
       straightPools[y] = groupPool.filter(s => s.existingClass.startsWith(y));
       straightCounts[y] = straightPools[y].length;
       totalStraightCount += straightPools[y].length;
    });

    let straightCreated = 0;
    years.forEach((y, i) => {
       if (!straightCounts[y]) return;
       let n = (i === years.length - 1) ? numStraight - straightCreated : Math.round((straightCounts[y]/totalStraightCount) * numStraight);
       if (numStraight === 0) n = 0;
       const [cls, ids] = runBalancing(straightPools[y], n);
       if (cls.length) final[`Straight Year ${parseInt(y)+1}`] = cls;
       ids.forEach(id => allPlacedIds.add(id));
       straightCreated += n;
    });

    const compPool = groupPool.filter(s => !allPlacedIds.has(s.id));
    const [compCls, compIds] = runBalancing(compPool, compositeClassesInput);
    if (compCls.length) final[`Composite ${years.map(y=>parseInt(y)+1).join('/')}`] = compCls;

    setGeneratedClasses(final);
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination } = result;
    const [sGroup, sIdx] = source.droppableId.split('::');
    const [dGroup, dIdx] = destination.droppableId.split('::');
    
    const newClasses = { ...generatedClasses };
    const srcList = newClasses[sGroup][sIdx].students;
    const destList = newClasses[dGroup][dIdx].students;
    const [moved] = srcList.splice(source.index, 1);
    destList.splice(destination.index, 0, moved);

    [newClasses[sGroup][sIdx], newClasses[dGroup][dIdx]].forEach(c => {
       c.stats = { gender: {}, academic: {}, behaviour: {}, existingClass: {} };
       c.students.forEach(s => ['academic', 'behaviour', 'gender', 'existingClass'].forEach(k => c.stats[k][s[k]||'Unknown'] = (c.stats[k][s[k]||'Unknown']||0)+1));
    });
    setGeneratedClasses(newClasses);
  };

  const getHighlight = (name, list) => {
     if (friendRequests.some(req => req.students.includes(name) && list.some(s => req.students.includes(s.fullName) && s.fullName !== name))) return "bg-green-200 font-bold";
     if (separationRequests.some(req => req.students.includes(name))) return "bg-red-200 font-bold";
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
             <input type="number" value={classSizeRange.min} onChange={e => setClassSizeRange({...classSizeRange, min:parseInt(e.target.value)})} className="shadow border rounded w-1/2 py-2 px-3" placeholder="Min" />
             <input type="number" value={classSizeRange.max} onChange={e => setClassSizeRange({...classSizeRange, max:parseInt(e.target.value)})} className="shadow border rounded w-1/2 py-2 px-3" placeholder="Max" />
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

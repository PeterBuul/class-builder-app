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

  // --- PARSING LOGIC (FIXED FOR MULTIPLE REQUESTS) ---
  useEffect(() => {
    const newFriendRequests = [];
    const newSeparationRequests = [];

    const findStudentFullName = (partialName, allStudents) => {
      if (!partialName) return null;
      const pName = partialName.toLowerCase().trim();
      if (!pName) return null;
      
      // 1. Exact match
      let match = allStudents.find(s => s.fullName.toLowerCase() === pName);
      if (match) return match.fullName;

      // 2. Starts with
      match = allStudents.find(s => s.fullName.toLowerCase().startsWith(pName));
      if (match) return match.fullName;
      
      return null; 
    };

    // Helper to split multiple names in one cell (e.g. "Tom, Harry")
    const parseNames = (rawString) => {
        if (!rawString) return [];
        // Split by comma, ampersand, or semicolon
        return rawString.split(/[,&;]/).map(s => s.trim()).filter(Boolean);
    };

    students.forEach(student => {
      // 1. Process Pairs
      if (student.requestPair) {
        const names = parseNames(student.requestPair);
        names.forEach(name => {
            const friendFullName = findStudentFullName(name, students);
            if (friendFullName && student.fullName !== friendFullName) {
                // Avoid duplicate rules
                const exists = newFriendRequests.some(r => 
                    (r.students.includes(student.fullName) && r.students.includes(friendFullName))
                );
                if (!exists) {
                    newFriendRequests.push({ students: [student.fullName, friendFullName] });
                }
            }
        });
      }
      
      // 2. Process Separations
      if (student.requestSeparate) {
        const names = parseNames(student.requestSeparate);
        names.forEach(name => {
            const separateFullName = findStudentFullName(name, students);
            if (separateFullName && student.fullName !== separateFullName) {
                const exists = newSeparationRequests.some(r => 
                    (r.students.includes(student.fullName) && r.students.includes(separateFullName))
                );
                if (!exists) {
                    newSeparationRequests.push({ students: [student.fullName, separateFullName] });
                }
            }
        });
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
    const text = e.target.value;
    const rows = text.split('\n').filter(row => row.trim() !== '');
    const headerRow = rows[0].split('\t');
    
    const dataRows = (headerRow.includes('Surname') || headerRow.includes('Class') ? rows.slice(1) : rows)
      .map(row => row.split('\t'));

    const dataObjects = dataRows.map(row => ({
      'Class': row[0],
      'Surname': row[1],
      'First Name': row[2],
      'Gender': row[3],
      'Academic': row[4],
      'Behaviour Needs': row[5],
      'Request: Pair': row[6],
      'Request: Separate': row[7],
    }));

    setStudents(parseStudentData(dataObjects));
  };

  const handleClassSizeChange = (field, value) => {
    setClassSizeRange(prev => ({ ...prev, [field]: parseInt(value, 10) || 0 }));
  };

  const downloadTemplate = () => {
    const headers = "Class,Surname,First Name,Gender,Academic,Behaviour Needs,Request: Pair,Request: Separate";
    const example1 = "4A,Smith,Jane,Female,High,Good,John Doe,Tom Lee";
    const example2 = "4B,Doe,John,Male,2,2,Jane S,"; 
    const example3 = "4A,Brown,Charlie,Male,Low,Needs Support,,";
    const example4 = "5A,Test,Alice,Female,3,High,,";
    const example5 = ",Note:,Academic/Behaviour scale can be High/Average/Low, 3/2/1, or Good/Needs Support etc.,,,,";
    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers, example1, example2, example3, example4, example5].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        allclasses.push({
          ...cls,
          groupName: groupName,
          classIndex: index + 1 
        });
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
    
    wsData.push(headerRow);
    wsData.push(subHeaderRow);

    const sortedAllClasses = allclasses.map(cls => ({
      ...cls,
      students: cls.students.sort((a,b) => a.surname.localeCompare(b.surname))
    }));
    
    for (let i = 0; i < maxLen; i++) { 
      const row = [];
      colIndex = 0;
      for (let c = 0; c < sortedAllClasses.length; c++) { 
        const cls = sortedAllClasses[c];
        const student = cls.students[i];
        if (student) {
          row[colIndex] = student.fullName;
          row[colIndex+1] = student.existingClass;
          row[colIndex+2] = student.academic;
          row[colIndex+3] = student.behaviour;
        }
        colIndex += 5;
      }
      wsData.push(row);
    }
    
    wsData.push([]); 
    const statsStartRow = wsData.length;
    
    const balanceTitleRow = [];
    const genderRow = [];
    const academicRow = [];
    const behaviourRow = [];

    colIndex = 0;
    allclasses.forEach((cls) => {
      balanceTitleRow[colIndex] = "--- Class Balance ---";
      
      genderRow[colIndex] = "Gender:";
      genderRow[colIndex+1] = Object.entries(cls.stats.gender).map(([k, v]) => `${k}: ${v}`).join(', ');
      
      academicRow[colIndex] = "Academic:";
      academicRow[colIndex+1] = academicOrder
        .map(level => (cls.stats.academic[level] > 0 ? `${level}: ${cls.stats.academic[level]}` : null))
        .filter(Boolean).join(', ');
      
      behaviourRow[colIndex] = "Behaviour:";
      behaviourRow[colIndex+1] = behaviourOrder
        .map(level => (cls.stats.behaviour[level] > 0 ? `${level}: ${cls.stats.behaviour[level]}` : null))
        .filter(Boolean).join(', ');
      
      colIndex += 5; 
    });
    
    wsData.push(balanceTitleRow, genderRow, academicRow, behaviourRow);

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
               if(!ws[ref]) ws[ref] = {v: wsData[r][colIndex+k] || "", t:'s'};
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
       ws['!merges'].push({ s: { r: statsStartRow, c: colIndex }, e: { r: statsStartRow, c: colIndex + 3 } }); 
       ws['!merges'].push({ s: { r: statsStartRow+1, c: colIndex+1 }, e: { r: statsStartRow+1, c: colIndex+3 } }); 
       ws['!merges'].push({ s: { r: statsStartRow+2, c: colIndex+1 }, e: { r: statsStartRow+2, c: colIndex+3 } }); 
       ws['!merges'].push({ s: { r: statsStartRow+3, c: colIndex+1 }, e: { r: statsStartRow+3, c: colIndex+3 } }); 
       colIndex += 5;
    }

    XLSX.utils.book_append_sheet(wb, ws, "Classes");
    XLSX.writeFile(wb, "Generated_Classes.xlsx");
  };

  // --- GENERATOR ---
  const violatesSeparation = (student, classStudents) => {
    for (const req of separationRequests) {
      const [s1, s2] = req.students;
      if ((student.fullName === s1 && classStudents.some(s => s.fullName === s2)) ||
          (student.fullName === s2 && classStudents.some(s => s.fullName === s1))) {
            return true;
      }
    }
    return false;
  };

  const costForStat = (value, category, cls, groupTotals, numClassesToMake) => {
    const totalCount = groupTotals[category][value] || 0;
    const idealCountPerClass = totalCount / numClassesToMake;
    const currentCount = (cls.stats[category] && cls.stats[category][value]) || 0;
    const currentBadness = Math.pow(currentCount - idealCountPerClass, 2);
    const newBadness = Math.pow((currentCount + 1) - idealCountPerClass, 2);
    return newBadness - currentBadness;
  };

  const calculatePlacementCost = (student, cls, groupTotals, numClassesToMake, allClassesInGroup) => {
    if (cls.students.length >= classSizeRange.max) return 1000000;
    if (violatesSeparation(student, cls.students)) return 1000000; // Separation is NON-NEGOTIABLE
    
    let cost = 0;
    // Water Filling: Penalize if bigger than smallest
    const minSize = Math.min(...allClassesInGroup.map(cl => cl.students.length));
    if (cls.students.length > minSize) cost += 5000;

    cost += 3.0 * costForStat(student.academic, 'academic', cls, groupTotals, numClassesToMake);
    cost += 3.0 * costForStat(student.behaviour, 'behaviour', cls, groupTotals, numClassesToMake);
    cost += 2.0 * costForStat(student.gender, 'gender', cls, groupTotals, numClassesToMake);
    
    return cost;
  };

  const runBalancing = (pool, count) => {
    if (count <= 0 || !pool.length) return [[], []];
    
    const classes = Array.from({ length: count }, () => ({
      students: [], stats: { gender: {}, academic: {}, behaviour: {}, existingClass: {} }
    }));
    const placedIds = [];
    const groupTotals = { academic: {}, behaviour: {}, gender: {}, existingClass: {} };
    
    pool.forEach(s => ['academic', 'behaviour', 'gender', 'existingClass'].forEach(k => 
        groupTotals[k][s[k]||'Unknown'] = (groupTotals[k][s[k]||'Unknown']||0)+1
    ));

    const updateStats = (c, s) => ['academic', 'behaviour', 'gender', 'existingClass'].forEach(k => 
        c.stats[k][s[k]||'Unknown'] = (c.stats[k][s[k]||'Unknown']||0)+1
    );

    // 1. Friends (Try to pair)
    friendRequests.forEach(req => {
      const [n1, n2] = req.students;
      const s1 = pool.find(s => s.fullName === n1 && !placedIds.includes(s.id));
      const s2 = pool.find(s => s.fullName === n2 && !placedIds.includes(s.id));
      
      if (s1 && s2) {
         classes.sort((a,b) => a.students.length - b.students.length);
         const bestC = classes[0];
         if (bestC.students.length + 2 <= classSizeRange.max) {
            bestC.students.push(s1, s2);
            updateStats(bestC, s1); updateStats(bestC, s2);
            placedIds.push(s1.id, s2.id);
         }
      }
    });

    // 2. Remaining
    let remaining = pool.filter(s => !placedIds.includes(s.id));
    for (let i = remaining.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]]; 
    }

    remaining.forEach(student => {
       let bestClass = null;
       let minCost = Infinity;
       const shuffledClasses = [...classes].sort(() => Math.random() - 0.5);

       shuffledClasses.forEach(cls => {
          const cost = calculatePlacementCost(student, cls, groupTotals, count, classes);
          if (cost < minCost) { minCost = cost; bestClass = cls; }
       });

       if (bestClass && minCost < 900000) {
          bestClass.students.push(student);
          updateStats(bestClass, student);
          placedIds.push(student.id);
       } else {
          // Force fallback: smallest class that isn't full
          const fallback = classes.sort((a,b) => a.students.length - b.students.length)
             .find(c => c.students.length < classSizeRange.max);
          if (fallback) {
             fallback.students.push(student);
             updateStats(fallback, student);
             placedIds.push(student.id);
          }
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
    const allGroupStudents = students.filter(s => years.some(year => s.existingClass.startsWith(year)));

    const straightPools = {};
    const straightCounts = {};
    let totalCount = 0;
    
    years.forEach(year => {
       const yearPool = allGroupStudents.filter(s => s.existingClass.startsWith(year));
       straightPools[year] = yearPool;
       straightCounts[year] = yearPool.length;
       totalCount += yearPool.length;
    });

    let straightCreated = 0;
    years.forEach((year, index) => {
       if (!straightCounts[year]) return;
       let n = (totalCount > 0) ? Math.round((straightCounts[year]/totalCount) * numStraight) : 0;
       if (index === years.length - 1) n = numStraight - straightCreated;
       if (numStraight <= 0) n = 0;
       
       if (n > 0) {
           const [cls, ids] = runBalancing(straightPools[year], n);
           if (cls.length) final[`Straight Year ${parseInt(year, 10) + 1}`] = cls;
           ids.forEach(id => allPlacedIds.add(id));
       }
       straightCreated += n;
    });

    const compPool = allGroupStudents.filter(s => !allPlacedIds.has(s.id));
    if (compositeClassesInput > 0) {
        const [compCls, ids] = runBalancing(compPool, compositeClassesInput);
        if (compCls.length) final[`Composite ${years.map(y=>parseInt(y)+1).join('/')}`] = compCls;
        ids.forEach(id => allPlacedIds.add(id));
    }

    setGeneratedClasses(final);
    showNotification("Classes Generated!");
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;
    const { source, destination, draggableId } = result;
    
    const [sGroup, sIdx] = source.droppableId.split('::');
    const [dGroup, dIdx] = destination.droppableId.split('::');

    const newClasses = { ...generatedClasses };
    const srcList = newClasses[sGroup][sIdx].students;
    const destList = newClasses[dGroup][dIdx].students;

    const movedIdx = srcList.findIndex(s => String(s.id) === draggableId);
    if(movedIdx === -1) return;
    const [moved] = srcList.splice(movedIdx, 1);
    destList.splice(destination.index, 0, moved);

    const recalc = (c) => {
       c.stats = { gender: {}, academic: {}, behaviour: {}, existingClass: {} };
       c.students.forEach(s => ['academic', 'behaviour', 'gender', 'existingClass'].forEach(k => c.stats[k][s[k]||'Unknown'] = (c.stats[k][s[k]||'Unknown']||0)+1));
    };
    recalc(newClasses[sGroup][sIdx]);
    recalc(newClasses[dGroup][dIdx]);

    setGeneratedClasses(newClasses);
  };

  const getHighlight = (name, list) => {
     let highlight = '';
     if (friendRequests.some(req => req.students.includes(name) && list.some(s => req.students.includes(s.fullName) && s.fullName !== name))) highlight = "text-green-700 font-bold";
     if (separationRequests.some(req => req.students.includes(name))) highlight = "text-red-600 font-bold";
     return highlight;
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
          <textarea id="studentNames" className="shadow border rounded w-full py-2 px-3 h-32" placeholder="Paste here..." onChange={handleStudentNamesInput}></textarea>
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
                                 <Draggable key={s.id} draggableId={String(s.id)} index={i}>
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

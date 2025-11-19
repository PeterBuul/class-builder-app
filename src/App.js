import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
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

  // --- SAVE & LOAD FUNCTIONALITY ---
  const saveProgress = () => {
    const dataToSave = {
      students,
      yearLevelsInput,
      totalClassesInput,
      compositeClassesInput,
      classSizeRange,
      friendRequests,
      separationRequests,
      generatedClasses
    };
    localStorage.setItem('classBuilderSave', JSON.stringify(dataToSave));
    showNotification('Progress Saved! You can close the browser and come back later.');
  };

  const loadProgress = () => {
    const savedData = localStorage.getItem('classBuilderSave');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setStudents(parsed.students || []);
      setYearLevelsInput(parsed.yearLevelsInput || '7');
      setTotalClassesInput(parsed.totalClassesInput || 0);
      setCompositeClassesInput(parsed.compositeClassesInput || 0);
      setClassSizeRange(parsed.classSizeRange || { min: 20, max: 30 });
      setFriendRequests(parsed.friendRequests || []);
      setSeparationRequests(parsed.separationRequests || []);
      setGeneratedClasses(parsed.generatedClasses || {});
      showNotification('Progress Loaded successfully.');
    } else {
      showNotification('No saved progress found.');
    }
  };

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 3000);
  };

  // Auto-parse requests
  useEffect(() => {
    const newFriendRequests = [];
    const newSeparationRequests = [];

    const findStudentFullName = (partialName, allStudents) => {
      if (!partialName) return null;
      const pName = partialName.toLowerCase().trim();
      let match = allStudents.find(s => s.fullName.toLowerCase() === pName);
      if (match) return match.fullName;
      match = allStudents.find(s => s.fullName.toLowerCase().startsWith(pName));
      if (match) return match.fullName;
      return null;
    };

    students.forEach(student => {
      if (student.requestPair) {
        const friendFullName = findStudentFullName(student.requestPair, students);
        if (friendFullName && student.fullName !== friendFullName) {
          if (!newFriendRequests.some(r => r.students.includes(student.fullName) && r.students.includes(friendFullName))) {
            newFriendRequests.push({ students: [student.fullName, friendFullName], requestedBy: 'Import' });
          }
        }
      }
      if (student.requestSeparate) {
        const separateFullName = findStudentFullName(student.requestSeparate, students);
        if (separateFullName && student.fullName !== separateFullName) {
          if (!newSeparationRequests.some(r => r.students.includes(student.fullName) && r.students.includes(separateFullName))) {
            newSeparationRequests.push({ students: [student.fullName, separateFullName], requestedBy: 'Import' });
          }
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
    if (val === '') return 'Unknown';
    return val.charAt(0).toUpperCase() + val.slice(1);
  };

  const parseStudentData = (data) => {
    return data.map((row, index) => {
      const fullName = `${row['First Name'] || ''} ${row.Surname || ''}`.trim();
      return {
        id: `student-${Date.now()}-${index}-${Math.random()}`, // Robust ID for DND
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
        allclasses.push({ ...cls, groupName: groupName, classIndex: index + 1 });
        if (cls.students.length > maxLen) maxLen = cls.students.length;
      });
    });

    if (allclasses.length === 0) {
      alert("No classes generated to export.");
      return;
    }
    
    let colIndex = 0;
    allclasses.forEach((cls) => {
      const classTitle = `${cls.groupName} - Class ${cls.classIndex} (${cls.students.length})`;
      headerRow[colIndex] = classTitle;
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
    const balanceTitleRow = [], genderRow = [], academicRow = [], behaviourRow = [];

    colIndex = 0;
    allclasses.forEach((cls) => {
      balanceTitleRow[colIndex] = "--- Class Balance ---";
      genderRow[colIndex] = "Gender:";
      genderRow[colIndex+1] = Object.entries(cls.stats.gender).map(([k, v]) => `${k}: ${v}`).join(', ');
      academicRow[colIndex] = "Academic:";
      academicRow[colIndex+1] = academicOrder.map(level => (cls.stats.academic[level] > 0 ? `${level}: ${cls.stats.academic[level]}` : null)).filter(Boolean).join(', ');
      behaviourRow[colIndex] = "Behaviour:";
      behaviourRow[colIndex+1] = behaviourOrder.map(level => (cls.stats.behaviour[level] > 0 ? `${level}: ${cls.stats.behaviour[level]}` : null)).filter(Boolean).join(', ');
      colIndex += 5;
    });
    
    wsData.push(balanceTitleRow, genderRow, academicRow, behaviourRow);

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = [];
    colIndex = 0;
    for (let i = 0; i < allclasses.length; i++) {
      ws['!merges'].push({ s: { c: colIndex, r: 0 }, e: { c: colIndex + 3, r: 0 } });
      ws['!merges'].push({ s: { c: colIndex, r: statsStartRow }, e: { c: colIndex + 3, r: statsStartRow } });
      ws['!merges'].push({ s: { c: colIndex+1, r: statsStartRow+1 }, e: { c: colIndex + 3, r: statsStartRow+1 } });
      ws['!merges'].push({ s: { c: colIndex+1, r: statsStartRow+2 }, e: { c: colIndex + 3, r: statsStartRow+2 } });
      ws['!merges'].push({ s: { c: colIndex+1, r: statsStartRow+3 }, e: { c: colIndex + 3, r: statsStartRow+3 } });
      colIndex += 5;
    }
    
    const boldStyle = { font: { bold: true } };
    for (let r = 2; r < maxLen + 2; r++) {
      colIndex = 0;
      for (let c = 0; c < sortedAllClasses.length; c++) {
        const student = sortedAllClasses[c].students[r-2];
        if (student) {
          const highlight = getFriendSeparationHighlight(student.fullName, sortedAllClasses[c].students);
          if (highlight === 'font-bold') {
            for (let i = 0; i < 4; i++) {
              const cellRef = XLSX.utils.encode_cell({ r: r, c: colIndex + i });
              if (!ws[cellRef]) ws[cellRef] = { v: wsData[r][colIndex + i] };
              ws[cellRef].s = boldStyle;
            }
          }
        }
        colIndex += 5;
      }
    }

    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, "Generated Classes");
    XLSX.writeFile(wb, "generated_classes.xlsx");
  };

  const violatesSeparation = (student, classStudents) => {
    for (const req of separationRequests) {
      const [s1, s2] = req.students;
      if (student.fullName === s1 && classStudents.some(s => s.fullName === s2)) return true;
      if (student.fullName === s2 && classStudents.some(s => s.fullName === s1)) return true;
    }
    return false;
  };

  const costForStat = (value, category, cls, groupTotals, numClassesToMake) => {
    const totalCount = groupTotals[category][value] || 0;
    const idealCountPerClass = totalCount / numClassesToMake;
    const currentCount = (cls.stats[category] && cls.stats[category][value]) || 0;
    return Math.pow((currentCount + 1) - idealCountPerClass, 2) - Math.pow(currentCount - idealCountPerClass, 2);
  };

  const calculatePlacementCost = (student, cls, groupTotals, numClassesToMake) => {
    if (cls.students.length >= classSizeRange.max) return Infinity;
    if (violatesSeparation(student, cls.students)) return Infinity;
    let cost = 0;
    cost += 3.0 * costForStat(student.academic, 'academic', cls, groupTotals, numClassesToMake);
    cost += 3.0 * costForStat(student.behaviour, 'behaviour', cls, groupTotals, numClassesToMake);
    cost += 2.0 * costForStat(student.gender, 'gender', cls, groupTotals, numClassesToMake);
    cost += 1.0 * costForStat(student.existingClass, 'existingClass', cls, groupTotals, numClassesToMake);
    cost += 0.1 * cls.students.length;
    return cost;
  };

  const runBalancing = (studentPool, numClassesToMake) => {
    if (numClassesToMake <= 0 || !studentPool || studentPool.length === 0) return [[], []];

    const availableStudents = [...studentPool];
    const placedStudentIds = [];
    const newClasses = Array.from({ length: numClassesToMake }, () => ({
      students: [],
      stats: { gender: {}, academic: {}, behaviour: {}, existingClass: {} },
    }));

    const groupTotals = { academic: {}, behaviour: {}, gender: {}, existingClass: {} };
    const categories = ['academic', 'behaviour', 'gender', 'existingClass'];
    for (const student of availableStudents) {
      for (const category of categories) {
        const value = student[category] || 'Unknown';
        groupTotals[category][value] = (groupTotals[category][value] || 0) + 1;
      }
    }

    friendRequests.forEach(req => {
      const [name1, name2] = req.students;
      const s1Index = availableStudents.findIndex(s => s.fullName === name1 && !placedStudentIds.includes(s.id));
      const s2Index = availableStudents.findIndex(s => s.fullName === name2 && !placedStudentIds.includes(s.id));
      
      if (s1Index > -1 && s2Index > -1) {
        const s1 = availableStudents[s1Index];
        const s2 = availableStudents[s2Index];
        newClasses.sort((a, b) => a.students.length - b.students.length);
        if (newClasses[0].students.length + 2 <= classSizeRange.max) {
          newClasses[0].students.push(s1, s2);
          updateClassStats(newClasses[0], s1);
          updateClassStats(newClasses[0], s2);
          placedStudentIds.push(s1.id, s2.id);
        }
      }
    });
    
    let remainingStudents = availableStudents.filter(s => !placedStudentIds.includes(s.id));
    for (let i = remainingStudents.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingStudents[i], remainingStudents[j]] = [remainingStudents[j], remainingStudents[i]];
    }

    for (const student of remainingStudents) {
      let bestClass = null;
      let minCost = Infinity;
      const shuffledClasses = [...newClasses].sort(() => Math.random() - 0.5);

      for (const cls of shuffledClasses) {
        const cost = calculatePlacementCost(student, cls, groupTotals, numClassesToMake);
        if (cost < minCost) {
          minCost = cost;
          bestClass = cls;
        }
      }

      if (bestClass && minCost !== Infinity) {
        bestClass.students.push(student);
        updateClassStats(bestClass, student);
        placedStudentIds.push(student.id);
      } else {
        const fallbackClass = newClasses.find(c => c.students.length < classSizeRange.max);
        if (fallbackClass) {
          fallbackClass.students.push(student);
          updateClassStats(fallbackClass, student);
          placedStudentIds.push(student.id);
        } else {
           console.error(`!!! FAILED TO PLACE ${student.fullName}.`);
        }
      }
    }
    return [newClasses, placedStudentIds];
  }

  const generateClasses = () => {
    const yearLevels = yearLevelsInput.split(',').map(s => s.trim()).filter(Boolean);
    const numTotalClasses = totalClassesInput;
    const numCompositeClasses = compositeClassesInput;
    const numStraightClasses = numTotalClasses - numCompositeClasses;

    if (numTotalClasses <= 0 || yearLevels.length === 0) {
      setGeneratedClasses({});
      return;
    }

    const finalClasses = {};
    const allPlacedStudentIds = new Set();
    const allGroupStudents = students.filter(s => yearLevels.some(year => s.existingClass.startsWith(year)));

    const straightYearPools = {};
    const straightYearCounts = {};
    let totalStraightStudents = 0;

    yearLevels.forEach(year => {
      const yearPool = allGroupStudents.filter(s => s.existingClass.startsWith(year));
      straightYearPools[year] = yearPool;
      straightYearCounts[year] = yearPool.length;
      totalStraightStudents += yearPool.length;
    });

    let straightClassesCreated = 0;
    yearLevels.forEach((year, index) => {
      const studentCount = straightYearCounts[year];
      if (studentCount === 0) return;
      
      let numClassesForThisYear;
      if (numStraightClasses <= 0) {
         numClassesForThisYear = 0;
      } else if (index === yearLevels.length - 1) {
        numClassesForThisYear = numStraightClasses - straightClassesCreated;
      } else {
        numClassesForThisYear = (totalStraightStudents > 0) ? Math.round((studentCount / totalStraightStudents) * numStraightClasses) : 0;
        straightClassesCreated += numClassesForThisYear;
      }

      if(numClassesForThisYear < 0) numClassesForThisYear = 0;

      const [newClasses, placedIds] = runBalancing(straightYearPools[year], numClassesForThisYear);
      if (newClasses.length > 0) {
        finalClasses[`Straight Year ${parseInt(year, 10) + 1}`] = newClasses;
      }
      placedIds.forEach(id => allPlacedStudentIds.add(id));
    });

    const compositePool = allGroupStudents.filter(s => !allPlacedStudentIds.has(s.id));
    const [compositeClasses, placedIds] = runBalancing(compositePool, numCompositeClasses);

    if (compositeClasses.length > 0) {
      const nextYears = yearLevels.map(y => parseInt(y, 10) + 1).join('/');
      finalClasses[`Composite ${nextYears}`] = compositeClasses;
    }
    setGeneratedClasses(finalClasses);
    showNotification("Classes Generated Successfully!");
  };

  const updateClassStats = (cls, student) => {
    const gender = student.gender || 'Unknown';
    const academic = student.academic || 'Unknown';
    const behaviour = student.behaviour || 'Unknown';
    const existingClass = student.existingClass || 'Unknown';

    cls.stats.gender[gender] = (cls.stats.gender[gender] || 0) + 1;
    cls.stats.academic[academic] = (cls.stats.academic[academic] || 0) + 1;
    cls.stats.behaviour[behaviour] = (cls.stats.behaviour[behaviour] || 0) + 1;
    cls.stats.existingClass[existingClass] = (cls.stats.existingClass[existingClass] || 0) + 1;
  };
  
  // DND Logic
  const onDragEnd = (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const sourceIdParts = source.droppableId.split('::');
    const destIdParts = destination.droppableId.split('::');
    const sourceGroupName = sourceIdParts[0];
    const sourceClassIndex = parseInt(sourceIdParts[1], 10);
    const destGroupName = destIdParts[0];
    const destClassIndex = parseInt(destIdParts[1], 10);

    const newGeneratedClasses = { ...generatedClasses };
    const sourceClass = newGeneratedClasses[sourceGroupName][sourceClassIndex];
    const destClass = newGeneratedClasses[destGroupName][destClassIndex];

    const movedStudentIndex = sourceClass.students.findIndex(s => s.id === draggableId);
    const [movedStudent] = sourceClass.students.splice(movedStudentIndex, 1);
    destClass.students.splice(destination.index, 0, movedStudent);

    // Re-calc stats for source and dest
    const recalc = (c) => {
      c.stats = { gender: {}, academic: {}, behaviour: {}, existingClass: {} };
      c.students.forEach(s => updateClassStats(c, s));
    };
    recalc(sourceClass);
    recalc(destClass);

    setGeneratedClasses(newGeneratedClasses);
  };

  const getFriendSeparationHighlight = (studentName, classStudents) => {
    let highlight = '';
    friendRequests.forEach(req => {
      if (req.students.includes(studentName) && classStudents.some(s => req.students.includes(s.fullName) && s.fullName !== studentName)) {
        highlight = 'font-bold';
      }
    });
    separationRequests.forEach(req => {
      if (req.students.includes(studentName)) {
        highlight = 'font-bold';
      }
    });
    return highlight;
  };

  return (
    <div className="container mx-auto p-4 font-sans">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2 text-gray-800">Class Builder App</h1>
        <p className="text-xl text-gray-600 mb-8">Making building classes as easy as 1,2...3</p>
      </div>

      {notification && (
        <div className="fixed top-4 right-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 shadow-md z-50" role="alert">
          <p>{notification}</p>
        </div>
      )}

      <div className="flex gap-4 mb-6 justify-center">
         <button onClick={saveProgress} className="bg-indigo-600 hover:bg-indigo-800 text-white font-bold py-2 px-6 rounded shadow">
            Save Progress
         </button>
         <button onClick={loadProgress} className="bg-gray-600 hover:bg-gray-800 text-white font-bold py-2 px-6 rounded shadow">
            Load Progress
         </button>
      </div>

      <div className="mb-6 max-w-lg mx-auto">
          <button onClick={downloadTemplate} className="w-full bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
            Download CSV Template
          </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Student Input */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <label htmlFor="studentNames" className="block text-gray-700 text-sm font-bold mb-2">
            Paste Tab-Separated Data (including header) directly from the Template:
          </label>
          <textarea
            id="studentNames"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-4 h-32"
            placeholder="Class    Surname    First Name    Gender..."
            onChange={handleStudentNamesInput}
          ></textarea>
        </div>

        {/* Class Parameters */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Class Parameters</h2>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">Current Year Levels (e.g., 7 or 4, 5)</label>
            <input type="text" value={yearLevelsInput} onChange={(e) => setYearLevelsInput(e.target.value)} className="shadow border rounded w-full py-2 px-3" />
          </div>
          <div className="flex gap-4 mb-4">
             <div className="w-1/2">
                <label className="block text-gray-700 text-sm font-bold mb-2">Total Classes</label>
                <input type="number" value={totalClassesInput} onChange={(e) => setTotalClassesInput(parseInt(e.target.value)||0)} className="shadow border rounded w-full py-2 px-3" />
             </div>
             <div className="w-1/2">
                <label className="block text-gray-700 text-sm font-bold mb-2">Composite Classes</label>
                <input type="number" value={compositeClassesInput} onChange={(e) => setCompositeClassesInput(parseInt(e.target.value)||0)} className="shadow border rounded w-full py-2 px-3" />
             </div>
          </div>
          <div className="mb-4">
             <label className="block text-gray-700 text-sm font-bold mb-2">Class Size Range</label>
             <div className="flex gap-2">
                <input type="number" value={classSizeRange.min} onChange={(e) => handleClassSizeChange('min', e.target.value)} className="shadow border rounded w-1/2 py-2 px-3" placeholder="Min" />
                <input type="number" value={classSizeRange.max} onChange={(e) => handleClassSizeChange('max', e.target.value)} className="shadow border rounded w-1/2 py-2 px-3" placeholder="Max" />
             </div>
          </div>
        </div>
      </div>

      <button onClick={generateClasses} className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg text-xl w-full mb-8">
        Generate Classes
      </button>

      <DragDropContext onDragEnd={onDragEnd}>
        {Object.keys(generatedClasses).length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-gray-700">Generated Classes</h2>
              <button onClick={exportToXLSX} className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Export to .xlsx</button>
            </div>
            <p className="text-center text-gray-700 mb-6 font-medium">Feel free to drag and drop if you want a change before you export.</p>
            
            {Object.keys(generatedClasses).map(groupName => (
              <div key={groupName} className="mb-8">
                <h3 className="text-xl font-bold mb-4 text-gray-800">{groupName}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {generatedClasses[groupName].map((cls, index) => (
                    <div key={`${groupName}-${index}`} className="border border-gray-200 rounded-lg p-4 shadow-sm">
                      <h4 className="text-lg font-semibold mb-3 text-indigo-700">Class {index + 1} ({cls.students.length})</h4>
                      <table className="min-w-full divide-y divide-gray-200 mb-4">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Name</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Old</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Acad</th>
                            <th className="px-2 py-1 text-left text-xs font-medium text-gray-500">Beh</th>
                          </tr>
                        </thead>
                        <Droppable droppableId={`${groupName}::${index}`}>
                          {(provided) => (
                            <tbody ref={provided.innerRef} {...provided.droppableProps} className="bg-white divide-y divide-gray-200">
                              {cls.students.map((student, studentIndex) => (
                                <Draggable key={student.id} draggableId={student.id} index={studentIndex}>
                                  {(provided) => (
                                    <tr
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={getFriendSeparationHighlight(student.fullName, cls.students)}
                                    >
                                      <td className="px-2 py-2 text-sm font-medium text-gray-900">{student.fullName}</td>
                                      <td className="px-2 py-2 text-sm text-gray-500">{student.existingClass}</td>
                                      <td className="px-2 py-2 text-sm text-gray-500">{student.academic}</td>
                                      <td className="px-2 py-2 text-sm text-gray-500">{student.behaviour}</td>
                                    </tr>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </tbody>
                          )}
                        </Droppable>
                      </table>
                      {/* Stats Display */}
                      <div className="text-xs space-y-1 mt-2 pt-2 border-t">
                         <p><strong>Gender:</strong> {Object.entries(cls.stats.gender).map(([k,v])=>`${k}:${v}`).join(', ')}</p>
                         <p><strong>Academic:</strong> {academicOrder.map(l => cls.stats.academic[l] ? `${l}:${cls.stats.academic[l]}` : null).filter(Boolean).join(', ')}</p>
                         <p><strong>Behaviour:</strong> {behaviourOrder.map(l => cls.stats.behaviour[l] ? `${l}:${cls.stats.behaviour[l]}` : null).filter(Boolean).join(', ')}</p>
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

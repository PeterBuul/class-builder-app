import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

function App() {
  const [students, setStudents] = useState([]);
  
  // NEW: Simplified Class Parameters state
  const [yearLevelsInput, setYearLevelsInput] = useState('7');
  const [totalClassesInput, setTotalClassesInput] = useState(0);
  const [compositeClassesInput, setCompositeClassesInput] = useState(0);

  const [classSizeRange, setClassSizeRange] = useState({ min: 20, max: 30 });
  const [friendRequests, setFriendRequests] = useState([]);
  const [separationRequests, setSeparationRequests] = useState([]);
  const [generatedClasses, setGeneratedClasses] = useState({});

  // Auto-parse friend/separation requests from student data
  useEffect(() => {
    const newFriendRequests = [];
    const newSeparationRequests = [];

    // "Smart" name finder. Finds "John D" or "John" from the list.
    const findStudentFullName = (partialName, allStudents) => {
      if (!partialName) return null;
      const pName = partialName.toLowerCase().trim();
      
      // 1. Try exact full name match (case-insensitive)
      let match = allStudents.find(s => s.fullName.toLowerCase() === pName);
      if (match) return match.fullName;

      // 2. Try "starts with" match (e.g., "John D" matches "John Doe")
      match = allStudents.find(s => s.fullName.toLowerCase().startsWith(pName));
      if (match) return match.fullName;
      
      return null; // No match found
    };

    students.forEach(student => {
      // Logic for "Request: Pair"
      if (student.requestPair) {
        const friendFullName = findStudentFullName(student.requestPair, students);
        // Add request if found, not a self-pair, and not a duplicate
        if (friendFullName && student.fullName !== friendFullName) {
          if (!newFriendRequests.some(r => r.students.includes(student.fullName) && r.students.includes(friendFullName))) {
            newFriendRequests.push({ students: [student.fullName, friendFullName], requestedBy: 'Import' });
          }
        }
      }
      
      // Logic for "Request: Separate"
      if (student.requestSeparate) {
        const separateFullName = findStudentFullName(student.requestSeparate, students);
        // Add request if found, not a self-pair, and not a duplicate
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

  // Normalizes flexible ranking inputs (e.g., "1", "low", "below")
  const normalizeRanking = (input) => {
    const val = String(input).toLowerCase().trim();
    if (['low', '1', 'below'].includes(val)) return 'Low';
    if (['at', '2', 'medium', 'average'].includes(val)) return 'Average';
    if (['above', '3', 'high'].includes(val)) return 'High';
    if (val === '') return 'Unknown';
    // Capitalize first letter if it's a non-standard value
    return val.charAt(0).toUpperCase() + val.slice(1);
  };

  // Parse student data from spreadsheet or text paste
  const parseStudentData = (data) => {
    return data.map((row, index) => {
      const fullName = `${row['First Name'] || ''} ${row.Surname || ''}`.trim();
      return {
        id: Date.now() + Math.random() + index,
        firstName: row['First Name'] || '',
        surname: row.Surname || '',
        fullName: fullName || `Student ${index + 1}`,
        existingClass: row.Class || 'Unknown',
        gender: row.Gender || 'Unknown',
        academic: normalizeRanking(row.Academic || 'Average'),
        behaviour: normalizeRanking(row.Behaviour || 'Good'),
        requestPair: row['Request: Pair'] || '',
        requestSeparate: row['Request: Separate'] || '',
      };
    }).filter(s => s.fullName !== 'Student');
  };

  // Handle pasted text data
  const handleStudentNamesInput = (e) => {
    const text = e.target.value;
    const rows = text.split('\n').filter(row => row.trim() !== '');
    
    const headerRow = rows[0].split('\t');
    const hasHeader = headerRow.includes('Surname') || headerRow.includes('Class');
    
    const dataRows = (hasHeader ? rows.slice(1) : rows)
      .map(row => row.split('\t'));

    // Map to new 8-column structure
    const dataObjects = dataRows.map(row => ({
      'Class': row[0],
      'Surname': row[1],
      'First Name': row[2],
      'Gender': row[3],
      'Academic': row[4],
      'Behaviour': row[5],
      'Request: Pair': row[6],
      'Request: Separate': row[7],
    }));

    setStudents(parseStudentData(dataObjects));
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet);
        setStudents(parseStudentData(json));
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleClassSizeChange = (field, value) => {
    setClassSizeRange(prev => ({ ...prev, [field]: parseInt(value, 10) || 0 }));
  };

  // Function to download a CSV template
  const downloadTemplate = () => {
    const headers = "Class,Surname,First Name,Gender,Academic,Behaviour,Request: Pair,Request: Separate";
    const example1 = "7A,Smith,Jane,Female,High,Good,John Doe,Tom Lee";
    const example2 = "7B,Doe,John,Male,2,2,Jane S,"; // Smart request example
    const example3 = "7A,Brown,Charlie,Male,Low,Needs Support,,";
    const csvContent = "data:text/csv;charset=utf-8," + 
      headers + "\n" + example1 + "\n" + example2 + "\n" + example3;
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Function to export generated classes to XLSX
  const exportToXLSX = () => {
    const wb = XLSX.utils.book_new();

    Object.keys(generatedClasses).forEach(groupName => {
      const yearClasses = generatedClasses[groupName];
      if (!yearClasses || yearClasses.length === 0) return;

      const wsData = [];
      
      // Find max class length
      const maxLen = Math.max(...yearClasses.map(cls => cls.students.length));
      
      // 1. Create Headers (e.g., "Class 1", "Class 2")
      const headerRow = [];
      const subHeaderRow = [];
      
      yearClasses.forEach((cls, index) => {
        headerRow.push(`Class ${index + 1} (${cls.students.length} students)`);
        headerRow.push(null, null, null); // Merge cells for 4 columns
        
        subHeaderRow.push('Student Name', 'Old Class', 'Academic', 'Behaviour');
      });
      
      wsData.push(headerRow);
      wsData.push(subHeaderRow);
      
      // 2. Create Data Rows
      for (let i = 0; i < maxLen; i++) {
        const row = [];
        yearClasses.forEach(cls => {
          // Get sorted students once per class
          const sortedStudents = cls.students.sort((a,b) => a.surname.localeCompare(b.surname));
          const student = sortedStudents[i];
          if (student) {
            row.push(student.fullName);
            row.push(student.existingClass);
            row.push(student.academic);
            row.push(student.behaviour);
          } else {
            row.push(null, null, null, null); // Empty cells
          }
        });
        wsData.push(row);
      }
      
      // 3. Create worksheet from array of arrays
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // 4. Add Merges
      ws['!merges'] = [];
      for (let i = 0; i < yearClasses.length; i++) {
        ws['!merges'].push({
          s: { c: i * 4, r: 0 }, // Start cell (col, row)
          e: { c: (i * 4) + 3, r: 0 }  // End cell (col, row)
        });
      }
      
      // 5. Add Styling (Highlights)
      const greenFill = { fill: { fgColor: { rgb: "FFC7EFCF" } } }; // Light Green
      const redFill = { fill: { fgColor: { rgb: "FFFFC7CE" } } }; // Light Red

      for (let r = 2; r < wsData.length; r++) { // Start from data row (index 2)
        for (let c = 0; c < yearClasses.length; c++) {
          const studentCellRef = XLSX.utils.encode_cell({ r: r, c: c * 4 });
          const studentCell = ws[studentCellRef];
          
          if (studentCell && studentCell.v) {
            const studentName = studentCell.v;
            const classStudents = yearClasses[c].students;
            
            // Get highlight color
            let highlight = '';
            // Friend check
            friendRequests.forEach(req => {
              if (req.students.includes(studentName) && classStudents.some(s => req.students.includes(s.fullName) && s.fullName !== studentName)) {
                highlight = 'green';
              }
            });
            // Separation check
            separationRequests.forEach(req => {
              if (req.students.includes(studentName) && classStudents.some(s => req.students.includes(s.fullName) && s.fullName !== studentName)) {
                highlight = 'red';
              }
            });
            
            // Apply style to cell
            if (highlight === 'green') {
              studentCell.s = greenFill;
            } else if (highlight === 'red') {
              studentCell.s = redFill;
            }
          }
        }
      }
      
      // 6. Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, groupName);
    });
    
    // 7. Write and download
    if (wb.SheetNames.length > 0) {
      XLSX.writeFile(wb, "generated_classes.xlsx");
    } else {
      console.error("No data to export");
    }
  };


  const violatesSeparation = (student, classStudents) => {
    for (const req of separationRequests) {
      const [s1, s2] = req.students;
      if (student.fullName === s1 && classStudents.some(s => s.fullName === s2)) return true;
      if (student.fullName === s2 && classStudents.some(s => s.fullName === s1)) return true;
    }
    return false;
  };

  /**
   * NEW: This is the core balancing logic, extracted into a reusable function.
   */
  const runBalancing = (studentPool, numClassesToMake) => {
    if (numClassesToMake <= 0 || !studentPool || studentPool.length === 0) {
      return [[], []]; // Return empty results
    }

    const availableStudents = [...studentPool];
    const placedStudentIds = [];
    const newClasses = Array.from({ length: numClassesToMake }, () => ({
      students: [],
      stats: { gender: {}, academic: {}, behaviour: {}, existingClass: {} },
    }));

    // 1. Pre-calculate totals for this specific pool
    const groupTotals = { academic: {}, behaviour: {}, gender: {}, existingClass: {} };
    const categories = ['academic', 'behaviour', 'gender', 'existingClass'];
    for (const student of availableStudents) {
      for (const category of categories) {
        const value = student[category] || 'Unknown';
        groupTotals[category][value] = (groupTotals[category][value] || 0) + 1;
      }
    }

    // 2. Handle Friend Requests (pre-seeding)
    friendRequests.forEach(req => {
      const [name1, name2] = req.students;
      const s1Index = availableStudents.findIndex(s => s.fullName === name1);
      const s2Index = availableStudents.findIndex(s => s.fullName === name2);
      
      if (s1Index > -1 && s2Index > -1) {
        const s1 = availableStudents[s1Index];
        const s2 = availableStudents[s2Index];
        
        newClasses.sort((a, b) => a.students.length - b.students.length);
        const bestClass = newClasses[0];

        if (bestClass.students.length + 2 <= classSizeRange.max) {
          bestClass.students.push(s1, s2);
          updateClassStats(bestClass, s1);
          updateClassStats(bestClass, s2);
          placedStudentIds.push(s1.id, s2.id);
        }
      }
    });
    
    let remainingStudents = availableStudents
      .filter(s => !placedStudentIds.includes(s.id))
      .sort(() => Math.random() - 0.5); // Shuffle

    // 3. Define Balancing Cost Functions
    const costForStat = (value, category, cls) => {
      const totalCount = groupTotals[category][value] || 0;
      const idealCountPerClass = totalCount / numClassesToMake;
      const currentCount = (cls.stats[category] && cls.stats[category][value]) || 0;
      const currentBadness = Math.pow(currentCount - idealCountPerClass, 2);
      const newBadness = Math.pow((currentCount + 1) - idealCountPerClass, 2);
      return newBadness - currentBadness;
    };

    const calculatePlacementCost = (student, cls) => {
      if (cls.students.length >= classSizeRange.max) return Infinity;
      if (violatesSeparation(student, cls.students)) return Infinity;
      let cost = 0;
      cost += 3.0 * costForStat(student.academic, 'academic', cls);
      cost += 3.0 * costForStat(student.behaviour, 'behaviour', cls);
      cost += 2.0 * costForStat(student.gender, 'gender', cls);
      cost += 1.0 * costForStat(student.existingClass, 'existingClass', cls);
      cost += 0.1 * cls.students.length;
      return cost;
    };

    // 4. Distribute all remaining students based on lowest cost
    for (const student of remainingStudents) {
      let bestClass = null;
      let minCost = Infinity;
      const shuffledClasses = newClasses.sort(() => Math.random() - 0.5);

      for (const cls of shuffledClasses) {
        const cost = calculatePlacementCost(student, cls);
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
           console.error(`!!! FAILED TO PLACE ${student.fullName}. All classes are full.`);
        }
      }
    }
    return [newClasses, placedStudentIds];
  }

  // Main logic to generate classes
  const generateClasses = () => {
    const yearLevels = yearLevelsInput.split(',').map(s => s.trim()).filter(Boolean);
    const numTotalClasses = totalClassesInput;
    const numCompositeClasses = compositeClassesInput;
    const numStraightClasses = numTotalClasses - numCompositeClasses;

    if (numTotalClasses <= 0 || yearLevels.length === 0) {
      setGeneratedClasses({}); // Clear old results
      return;
    }

    const finalClasses = {};
    const allPlacedStudentIds = new Set();

    // 1. Get all students for this entire group
    const allGroupStudents = students.filter(s => {
      const studentYear = s.existingClass.match(/\d+/); // Get "7" from "7A"
      if (!studentYear) return false;
      return yearLevels.includes(studentYear[0]);
    });

    // 2. Create and count separate pools for each straight year level
    const straightYearPools = {};
    const straightYearCounts = {};
    let totalStraightStudents = 0;

    yearLevels.forEach(year => {
      const yearPool = allGroupStudents.filter(s => s.existingClass.startsWith(year));
      straightYearPools[year] = yearPool;
      straightYearCounts[year] = yearPool.length;
      totalStraightStudents += yearPool.length;
    });

    // 3. Generate STRAIGHT classes proportionally
    let straightClassesCreated = 0;
    yearLevels.forEach((year, index) => {
      const studentCount = straightYearCounts[year];
      
      // Pro-rata calculation
      let numClassesForThisYear;
      if (index === yearLevels.length - 1) {
        // Last year level gets the remaining classes
        numClassesForThisYear = numStraightClasses - straightClassesCreated;
      } else {
        numClassesForThisYear = Math.round((studentCount / totalStraightStudents) * numStraightClasses);
        straightClassesCreated += numClassesForThisYear;
      }

      const [newClasses, placedIds] = runBalancing(
        straightYearPools[year], 
        numClassesForThisYear
      );

      if (newClasses.length > 0) {
        finalClasses[`Straight Year ${year}`] = newClasses;
      }
      placedIds.forEach(id => allPlacedStudentIds.add(id));
    });

    // 4. Generate COMPOSITE classes from the leftovers
    const compositePool = allGroupStudents.filter(s => !allPlacedStudentIds.has(s.id));
    
    const [compositeClasses, placedIds] = runBalancing(
      compositePool,
      numCompositeClasses
    );

    if (compositeClasses.length > 0) {
      const groupName = `Composite ${yearLevels.join('/')}`;
      finalClasses[groupName] = compositeClasses;
    }

    // *** THIS IS THE FIX: ***
    // Use the placedIds from the composite run
    placedIds.forEach(id => allPlacedStudentIds.add(id));
    
    setGeneratedClasses(finalClasses); // Set the final object
  };

  const updateClassStats = (cls, student) => {
    // Ensure all categories exist for stats
    const gender = student.gender || 'Unknown';
    const academic = student.academic || 'Unknown';
    const behaviour = student.behaviour || 'Unknown';
    const existingClass = student.existingClass || 'Unknown';

    cls.stats.gender[gender] = (cls.stats.gender[gender] || 0) + 1;
    cls.stats.academic[academic] = (cls.stats.academic[academic] || 0) + 1;
    cls.stats.behaviour[behaviour] = (cls.stats.behaviour[behaviour] || 0) + 1;
    cls.stats.existingClass[existingClass] = (cls.stats.existingClass[existingClass] || 0) + 1;
  };

  const getFriendSeparationHighlight = (studentName, classStudents) => {
    let highlight = '';
    // Check for friend pairings (Green)
    friendRequests.forEach(req => {
      if (req.students.includes(studentName) && classStudents.some(s => req.students.includes(s.fullName) && s.fullName !== studentName)) {
        highlight = 'bg-green-200'; // Friend pair
      }
    });
    // Check for separation violations (Red)
    separationRequests.forEach(req => {
      if (req.students.includes(studentName) && classStudents.some(s => req.students.includes(s.fullName) && s.fullName !== studentName)) {
        highlight = 'bg-red-200'; // Separation violation
      }
    });
    return highlight;
  };

  return (
    <div className="container mx-auto p-4 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Class Builder App</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Student Input */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Student Input</h2>
          <label htmlFor="studentNames" className="block text-gray-700 text-sm font-bold mb-2">
            Paste Tab-Separated Data (including header):
          </label>
          <textarea
            id="studentNames"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-4 h-32"
            placeholder="Class    Surname    First Name    Gender    Academic    Behaviour    Request: Pair    Request: Separate&#10;7A    Smith    Jane    Female    High    Good    John D    Tom Lee&#10;7B    Doe    John    Male    2    2    Jane Smith    "
            onChange={handleStudentNamesInput}
          ></textarea>
          <p className="text-gray-600 text-xs mb-4">
            Columns: **Class, Surname, First Name, Gender, Academic, Behaviour, Request: Pair, Request: Separate**
          </p>

          <label htmlFor="fileUpload" className="block text-gray-700 text-sm font-bold mb-2">
            Or Upload Spreadsheet (.xlsx, .csv):
          </label>
          <input
            type="file"
            id="fileUpload"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <p className="text-gray-600 text-xs mt-2 mb-4">
            Request columns can use partial names (e.g., "John D").
          </p>
          <button
            onClick={downloadTemplate}
            className="w-full bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Download CSV Template
          </button>
        </div>

        {/* Class Parameters */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Class Parameters</h2>
          
          {/* NEW Simplified Class Group Inputs */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Year Levels (e.g., 7 or 5, 6)
            </label>
            <input
              type="text"
              value={yearLevelsInput}
              onChange={(e) => setYearLevelsInput(e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              placeholder="e.g., 7 or 5, 6"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Total Number of Classes
            </label>
            <input
              type="number"
              value={totalClassesInput}
              onChange={(e) => setTotalClassesInput(parseInt(e.target.value, 10) || 0)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              min="0"
            />
          </div>

          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Number of Composite Classes
            </label>
            <input
              type="number"
              value={compositeClassesInput}
              onChange={(e) => setCompositeClassesInput(parseInt(e.target.value, 10) || 0)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              min="0"
            />
             <p className="text-gray-600 text-xs mt-2">
              Example: 6 Total Classes, 1 Composite = 5 Straight Classes (split proportionally) + 1 Composite Class (from leftovers).
            </p>
          </div>
          
          {/* Class Size Range */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Class Size Range (for all classes):
            </label>
            <div className="flex gap-4">
              <input
                type="number"
                value={classSizeRange.min}
                onChange={(e) => handleClassSizeChange('min', e.target.value)}
                className="shadow appearance-none border rounded w-1/2 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="Min"
                min="1"
              />
              <input
                type="number"
                value={classSizeRange.max}
                onChange={(e) => handleClassSizeChange('max', e.target.value)}
                className="shadow appearance-none border rounded w-1/2 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="Max"
                min="1"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={generateClasses}
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg focus:outline-none focus:shadow-outline text-xl w-full mb-8"
      >
        Generate Classes
      </button>

      {/* Generated Classes Output */}
      {Object.keys(generatedClasses).length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-700">Generated Classes</h2>
            <button
              onClick={exportToXLSX}
              className="bg-indigo-500 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            >
              Export to .xlsx
            </button>
          </div>
          
          {Object.keys(generatedClasses).map(groupName => (
            <div key={groupName} className="mb-8">
              <h3 className="text-xl font-bold mb-4 text-gray-800">{groupName}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {generatedClasses[groupName].map((cls, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 shadow-sm">
                    <h4 className="text-lg font-semibold mb-3 text-indigo-700">Class {index + 1} ({cls.students.length} students)</h4>
                    <table className="min-w-full divide-y divide-gray-200 mb-4">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Old Class</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Academic</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Behaviour</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {cls.students.sort((a,b) => a.surname.localeCompare(b.surname)).map(student => (
                          <tr key={student.id} className={getFriendSeparationHighlight(student.fullName, cls.students)}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{student.fullName}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{student.existingClass}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{student.academic}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{student.behaviour}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="text-sm">
                      <h5 className="font-semibold mt-4 mb-2 text-gray-700">Class Balance:</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="font-medium">Gender:</p>
                          {Object.entries(cls.stats.gender).map(([gender, count]) => (
                            <p key={gender} className={`px-2 py-1 rounded-md`}>
                              {gender}: {count}
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium">Academic:</p>
                          {Object.entries(cls.stats.academic).map(([academic, count]) => (
                            <p key={academic} className={`px-2 py-1 rounded-md`}>
                              {academic}: {count}
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium">Behaviour:</p>
                          {Object.entries(cls.stats.behaviour).map(([behaviour, count]) => (
                            <p key={behaviour} className={`px-2 py-1 rounded-md`}>
                              {behaviour}: {count}
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium">Previous Class:</p>
                          {Object.entries(cls.stats.existingClass).map(([className, count]) => (
                            <p key={className} className={`px-2 py-1 rounded-md`}>
                              {className}: {count}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;

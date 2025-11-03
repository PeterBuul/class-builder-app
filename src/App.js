import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

function App() {
  const [students, setStudents] = useState([]);
  const [yearLevelConfigs, setYearLevelConfigs] = useState([
    { id: Date.now(), name: 'Year 7', numClasses: 0 }
  ]);
  const [classSizeRange, setClassSizeRange] = useState({ min: 20, max: 30 });
  const [friendRequests, setFriendRequests] = useState([]);
  const [separationRequests, setSeparationRequests] = useState([]);
  const [generatedClasses, setGeneratedClasses] = useState({});

  // Auto-parse friend/separation requests from student data
  useEffect(() => {
    const newFriendRequests = [];
    const newSeparationRequests = [];

    students.forEach(student => {
      if (student.requests) {
        const reqs = student.requests.split(';');
        reqs.forEach(req => {
          const reqTrimmed = req.trim();
          if (reqTrimmed.toLowerCase().startsWith('pair:')) {
            const friendName = reqTrimmed.substring(5).trim();
            if (!newFriendRequests.some(r => r.students.includes(student.fullName) && r.students.includes(friendName))) {
              newFriendRequests.push({ students: [student.fullName, friendName], requestedBy: 'Import' });
            }
          } else if (reqTrimmed.toLowerCase().startsWith('separate:')) {
            const separateName = reqTrimmed.substring(9).trim();
            if (!newSeparationRequests.some(r => r.students.includes(student.fullName) && r.students.includes(separateName))) {
              newSeparationRequests.push({ students: [student.fullName, separateName], requestedBy: 'Import' });
            }
          }
        });
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
        // Apply normalization
        academic: normalizeRanking(row.Academic || 'Average'),
        behaviour: normalizeRanking(row.Behaviour || 'Good'),
        requests: row.Requests || '',
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

    const dataObjects = dataRows.map(row => ({
      'Class': row[0],
      'Surname': row[1],
      'First Name': row[2],
      'Gender': row[3],
      'Academic': row[4],
      'Behaviour': row[5],
      'Requests': row[6],
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

  // --- Dynamic Year Level Functions ---
  const handleYearLevelConfigChange = (id, field, value) => {
    setYearLevelConfigs(prevConfigs =>
      prevConfigs.map(config =>
        config.id === id ? { ...config, [field]: value } : config
      )
    );
  };

  const addYearLevelConfig = () => {
    setYearLevelConfigs(prevConfigs => [
      ...prevConfigs,
      { id: Date.now(), name: `Year ${7 + prevConfigs.length}`, numClasses: 0 }
    ]);
  };

  const removeYearLevelConfig = (id) => {
    setYearLevelConfigs(prevConfigs => prevConfigs.filter(config => config.id !== id));
  };
  // --- End Year Level Functions ---

  const handleClassSizeChange = (field, value) => {
    setClassSizeRange(prev => ({ ...prev, [field]: parseInt(value, 10) || 0 }));
  };

  // Function to download a CSV template
  const downloadTemplate = () => {
    const headers = "Class,Surname,First Name,Gender,Academic,Behaviour,Requests";
    const example1 = "7A,Smith,Jane,Female,High,Good,Pair: John Doe; Separate: Tom Lee";
    const example2 = "7B,Doe,John,Male,2,2,Pair: Jane Smith";
    const example3 = "7A,Brown,Charlie,Male,Low,Needs Support,";
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

  const violatesSeparation = (student, classStudents) => {
    for (const req of separationRequests) {
      const [s1, s2] = req.students;
      if (student.fullName === s1 && classStudents.some(s => s.fullName === s2)) return true;
      if (student.fullName === s2 && classStudents.some(s => s.fullName === s1)) return true;
    }
    return false;
  };

  // Main logic to generate classes
  const generateClasses = () => {
    // Filter students by year level (assuming year level is in the 'Class' name, e.g., "7A")
    // This is a simple filter; can be made more robust
    const allStudents = [...students];
    const classesByYear = {};

    yearLevelConfigs.forEach(config => {
      const year = config.name;
      const numClasses = parseInt(config.numClasses, 10);
      if (numClasses === 0 || !year) return; // Skip if no classes or name

      // Simple filter:
      const yearStudents = allStudents.filter(s => 
        s.existingClass.startsWith(year.match(/\d+/)) // e.g., "7" from "Year 7"
      );
      
      // If filter returns nothing, use all students (fallback)
      const availableStudents = yearStudents.length > 0 ? [...yearStudents] : [...allStudents];

      const newClasses = Array.from({ length: numClasses }, () => ({
        students: [],
        stats: { gender: {}, academic: {}, behaviour: {} },
        existingClassCounts: {}
      }));

      // 1. Prioritize friend requests
      const unplacedStudents = [];
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
            unplacedStudents.push(s1.id, s2.id);
          } else {
            console.warn(`Could not place friend request for ${name1} and ${name2}`);
          }
        }
      });
      
      let remainingStudents = availableStudents.filter(s => !unplacedStudents.includes(s.id));
      remainingStudents.sort(() => Math.random() - 0.5); // Shuffle

      // 2. Distribute all remaining students
      for (const student of remainingStudents) {
        newClasses.sort((a, b) => {
          const aFull = a.students.length >= classSizeRange.max;
          const bFull = b.students.length >= classSizeRange.max;
          if (aFull && !bFull) return 1;
          if (!aFull && bFull) return -1;
          
          const violatesA = violatesSeparation(student, a.students);
          const violatesB = violatesSeparation(student, b.students);
          if (violatesA && !violatesB) return 1;
          if (!violatesA && violationsB) return -1;
          if (violatesA && violatesB) return 0;

          const countA = a.existingClassCounts[student.existingClass] || 0;
          const countB = b.existingClassCounts[student.existingClass] || 0;
          if (countA !== countB) return countA - countB;

          return a.students.length - b.students.length;
        });

        const bestClass = newClasses[0];
        
        if (bestClass.students.length < classSizeRange.max && !violatesSeparation(student, bestClass.students)) {
          bestClass.students.push(student);
          updateClassStats(bestClass, student);
        } else {
          console.warn(`Could not place student ${student.fullName}.`);
        }
      }
      classesByYear[year] = newClasses;
    });

    setGeneratedClasses(classesByYear);
  };

  const updateClassStats = (cls, student) => {
    // Ensure all categories exist for stats
    const gender = student.gender || 'Unknown';
    const academic = student.academic || 'Unknown';
    const behaviour = student.behaviour || 'Unknown';

    cls.stats.gender[gender] = (cls.stats.gender[gender] || 0) + 1;
    cls.stats.academic[academic] = (cls.stats.academic[academic] || 0) + 1;
    cls.stats.behaviour[behaviour] = (cls.stats.behaviour[behaviour] || 0) + 1;
    cls.existingClassCounts[student.existingClass] = (cls.existingClassCounts[student.existingClass] || 0) + 1;
  };

  const getBalanceColor = (value, total, idealRange) => {
    if (total === 0) return '';
    const percentage = (value / total) * 100;
    if (percentage >= idealRange.min && percentage <= idealRange.max) {
      return 'bg-green-100'; // Good balance
    } else if (percentage >= idealRange.min * 0.75 && percentage <= idealRange.max * 1.25) {
      return 'bg-yellow-100'; // Acceptable balance
    }
    return 'bg-red-100'; // Poor balance
  };

  const getFriendSeparationHighlight = (studentName, classStudents) => {
    let highlight = '';
    friendRequests.forEach(req => {
      if (req.students.includes(studentName) && classStudents.some(s => req.students.includes(s.fullName) && s.fullName !== studentName)) {
        highlight = 'bg-blue-200'; // Friend pair
      }
    });
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
            placeholder="Class    Surname    First Name    Gender    Academic    Behaviour    Requests&#10;7A    Smith    Jane    Female    High    Good    Pair: John Doe&#10;7B    Doe    John    Male    2    2    Separate: Tom Lee"
            onChange={handleStudentNamesInput}
          ></textarea>
          <p className="text-gray-600 text-xs mb-4">
            Columns: **Class, Surname, First Name, Gender, Academic, Behaviour, Requests**
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
            Academic/Behaviour columns can use: `High/Medium/Low`, `3/2/1`, or `Above/At/Below`.
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
          
          {/* Dynamic Year Level Inputs */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Year Levels & Class Numbers:
            </label>
            {yearLevelConfigs.map(config => (
              <div key={config.id} className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => handleYearLevelConfigChange(config.id, 'name', e.target.value)}
                  className="shadow appearance-none border rounded w-1/2 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="Year Level Name"
                />
                <input
                  type="number"
                  value={config.numClasses}
                  onChange={(e) => handleYearLevelConfigChange(config.id, 'numClasses', parseInt(e.target.value, 10) || 0)}
                  className="shadow appearance-none border rounded w-1/4 py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  placeholder="# Classes"
                  min="0"
                />
                <button
                  onClick={() => removeYearLevelConfig(config.id)}
                  className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded focus:outline-none focus:shadow-outline"
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            ))}
            <button
              onClick={addYearLevelConfig}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline text-sm mt-1"
            >
              + Add Year Level
            </button>
          </div>
          
          {/* Class Size Range */}
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Class Size Range:
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
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">Generated Classes</h2>
          {Object.keys(generatedClasses).map(year => (
            <div key={year} className="mb-8">
              <h3 className="text-xl font-bold mb-4 text-gray-800">{year} Classes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {generatedClasses[year].map((cls, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 shadow-sm">
                    <h4 className="text-lg font-semibold mb-3 text-indigo-700">Class {index + 1} ({cls.students.length} students)</h4>
                    <table className="min-w-full divide-y divide-gray-200 mb-4">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student Name</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Old Class</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Academic</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {cls.students.sort((a,b) => a.surname.localeCompare(b.surname)).map(student => (
                          <tr key={student.id} className={getFriendSeparationHighlight(student.fullName, cls.students)}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{student.fullName}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{student.existingClass}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{student.gender}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{student.academic}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="text-sm">
                      <h5 className="font-semibold mt-4 mb-2 text-gray-700">Class Balance:</h5>
                      {/* FIX: Removed extra '.' from className */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="font-medium">Gender:</p>
                          {Object.entries(cls.stats.gender).map(([gender, count]) => (
                            // FIX: Removed extra 'J' from cls.students
                            <p key={gender} className={`px-2 py-1 rounded-md ${getBalanceColor(count, cls.students.length, { min: 30, max: 70 })}`}>
                              {gender}: {count}
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium">Academic:</p>
                          {Object.entries(cls.stats.academic).map(([academic, count]) => (
                            <p key={academic} className={`px-2 py-1 rounded-md ${getBalanceColor(count, cls.students.length, { min: 20, max: 40 })}`}>
                              {academic}: {count}
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium">Behaviour:</p>
                          {Object.entries(cls.stats.behaviour).map(([behaviour, count]) => (
                            <p key={behaviour} className={`px-2 py-1 rounded-md ${getBalanceColor(count, cls.students.length, { min: 20, max: 40 })}`}>
                              {behaviour}: {count}
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="font-medium">Previous Class:</p>
                          {Object.entries(cls.existingClassCounts).map(([className, count]) => (
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

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

function App() {
  const [students, setStudents] = useState([]);
  const [yearLevels, setYearLevels] = useState({});
  const [classSizeRange, setClassSizeRange] = useState({ min: 20, max: 30 });
  const [friendRequests, setFriendRequests] = useState([]);
  const [separationRequests, setSeparationRequests] = useState([]);
  const [generatedClasses, setGeneratedClasses] = useState({});

  // This effect now auto-parses the 'Requests' column from students
  // to populate the friend and separation request logic.
  useEffect(() => {
    const newFriendRequests = [];
    const newSeparationRequests = [];

    students.forEach(student => {
      if (student.requests) {
        // Simple parser: "Pair: John Doe" or "Separate: Jane Smith"
        // Can be separated by semicolons
        const reqs = student.requests.split(';');
        reqs.forEach(req => {
          const reqTrimmed = req.trim();
          if (reqTrimmed.toLowerCase().startsWith('pair:')) {
            const friendName = reqTrimmed.substring(5).trim();
            // Add request, avoiding duplicates
            if (!friendRequests.some(r => r.students.includes(student.fullName) && r.students.includes(friendName))) {
              newFriendRequests.push({ students: [student.fullName, friendName], requestedBy: 'Import' });
            }
          } else if (reqTrimmed.toLowerCase().startsWith('separate:')) {
            const separateName = reqTrimmed.substring(9).trim();
            // Add request, avoiding duplicates
            if (!separationRequests.some(r => r.students.includes(student.fullName) && r.students.includes(separateName))) {
              newSeparationRequests.push({ students: [student.fullName, separateName], requestedBy: 'Import' });
            }
          }
        });
      }
    });

    setFriendRequests(newFriendRequests);
    setSeparationRequests(newSeparationRequests);
  }, [students]);

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
        academic: row.Academic || 'Average',
        behaviour: row.Behaviour || 'Good',
        requests: row.Requests || '',
      };
    }).filter(s => s.fullName !== 'Student');
  };

  const handleStudentNamesInput = (e) => {
    const text = e.target.value;
    const rows = text.split('\n').filter(row => row.trim() !== '');
    
    // Assume first row is header if it contains 'Surname' or 'Class'
    const headerRow = rows[0].split('\t');
    const hasHeader = headerRow.includes('Surname') || headerRow.includes('Class');
    
    const dataRows = (hasHeader ? rows.slice(1) : rows)
      .map(row => row.split('\t'));

    // Manually map columns based on user's request
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
  
  const handleYearLevelChange = (year, value) => {
    setYearLevels(prev => ({ ...prev, [year]: parseInt(value, 10) || 0 }));
  };

  const handleClassSizeChange = (field, value) => {
    setClassSizeRange(prev => ({ ...prev, [field]: parseInt(value, 10) || 0 }));
  };

  const violatesSeparation = (student, classStudents) => {
    for (const req of separationRequests) {
      const [s1, s2] = req.students;
      if (student.fullName === s1 && classStudents.some(s => s.fullName === s2)) return true;
      if (student.fullName === s2 && classStudents.some(s => s.fullName === s1)) return true;
    }
    return false;
  };

  const generateClasses = () => {
    const allStudents = [...students];
    const classesByYear = {};

    Object.keys(yearLevels).forEach(year => {
      const numClasses = yearLevels[year];
      if (numClasses === 0) return;

      const availableStudents = [...allStudents];
      const newClasses = Array.from({ length: numClasses }, () => ({
        students: [],
        stats: { gender: { Male: 0, Female: 0, Unknown: 0 }, academic: {}, behaviour: {} },
        existingClassCounts: {} // <-- New property for blending
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
          
          // Find the best class (emptiest)
          newClasses.sort((a, b) => a.students.length - b.students.length);
          const bestClass = newClasses[0];

          if (bestClass.students.length + 2 <= classSizeRange.max) {
            bestClass.students.push(s1, s2);
            updateClassStats(bestClass, s1);
            updateClassStats(bestClass, s2);
            // Remove from available, adding to a temporary list for removal
            unplacedStudents.push(s1.id, s2.id);
          } else {
            console.warn(`Could not place friend request for ${name1} and ${name2}`);
          }
        }
      });
      
      let remainingStudents = availableStudents.filter(s => !unplacedStudents.includes(s.id));
      
      // Shuffle for randomness
      remainingStudents.sort(() => Math.random() - 0.5);

      // 2. Distribute all remaining students
      for (const student of remainingStudents) {
        // Find the best class based on new rules
        newClasses.sort((a, b) => {
          // Rule 1: Check if class is full
          const aFull = a.students.length >= classSizeRange.max;
          const bFull = b.students.length >= classSizeRange.max;
          if (aFull && !bFull) return 1;
          if (!aFull && bFull) return -1;
          
          // Rule 2: Check separation requests
          const violatesA = violatesSeparation(student, a.students);
          const violatesB = violatesSeparation(student, b.students);
          if (violatesA && !violatesB) return 1;
          if (!violatesA && violatesB) return -1;
          if (violatesA && violatesB) return 0; // Both bad

          // Rule 3: Blend existing class (primary sort key)
          const countA = a.existingClassCounts[student.existingClass] || 0;
          const countB = b.existingClassCounts[student.existingClass] || 0;
          if (countA !== countB) return countA - countB;

          // Rule 4: Smallest class (secondary sort key)
          return a.students.length - b.students.length;
        });

        const bestClass = newClasses[0];
        
        // Place student if class isn't full and doesn't violate separation
        if (bestClass.students.length < classSizeRange.max && !violatesSeparation(student, bestClass.students)) {
          bestClass.students.push(student);
          updateClassStats(bestClass, student);
          bestClass.existingClassCounts[student.existingClass] = (bestClass.existingClassCounts[student.existingClass] || 0) + 1;
        } else {
          console.warn(`Could not place student ${student.fullName}. All classes may be full or violate constraints.`);
          // This student will not be placed.
        }
      }
      classesByYear[year] = newClasses;
    });

    setGeneratedClasses(classesByYear);
  };

  const updateClassStats = (cls, student) => {
    cls.stats.gender[student.gender] = (cls.stats.gender[student.gender] || 0) + 1;
    cls.stats.academic[student.academic] = (cls.stats.academic[student.academic] || 0) + 1;
    cls.stats.behaviour[student.behaviour] = (cls.stats.behaviour[student.behaviour] || 0) + 1;
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
    // Check for friend pairings
    friendRequests.forEach(req => {
      if (req.students.includes(studentName) && classStudents.some(s => req.students.includes(s.fullName) && s.fullName !== studentName)) {
        highlight = 'bg-blue-200'; // Friend pair
      }
    });
    // Check for separation violations
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
            className="shadow appearance-none border rounded w-full py-2 px3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-4 h-32"
            placeholder="Class    Surname    First Name    Gender    Academic    Behaviour    Requests&#10;7A    Smith    Jane    Female    High    Good    Pair: John Doe&#10;7B    Doe    John    Male    Average    Good    Separate: Tom Lee"
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
          <p className="text-gray-600 text-xs mt-2">Expected columns: **Class, Surname, First Name, Gender, Academic, Behaviour, Requests**</p>
        </div>

        {/* Class Parameters */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Class Parameters</h2>
          <div className="mb-4">
            <label htmlFor="yearLevel" className="block text-gray-700 text-sm font-bold mb-2">
              Number of Classes for Year Level (e.g., Year 7):
            </label>
            <input
              type="number"
              id="yearLevel"
              value={yearLevels['Year 7'] || ''}
              onChange={(e) => handleYearLevelChange('Year 7', e.target.value)}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              min="0"
            />
          </div>
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
                          <th scope="col" className="px-3 py-2 text-left text-xs font-m edium text-gray-500 uppercase tracking-wider">Academic</th>
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
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="font-medium">Gender:</p>
                          {Object.entries(cls.stats.gender).map(([gender, count]) => (
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

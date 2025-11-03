import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

function App() {
  const [students, setStudents] = useState([]);
  const [yearLevels, setYearLevels] = useState({});
  const [classSizeRange, setClassSizeRange] = useState({ min: 20, max: 30 });
  const [parameters, setParameters] = useState({});
  const [friendRequests, setFriendRequests] = useState([]);
  const [separationRequests, setSeparationRequests] = useState([]);
  const [generatedClasses, setGeneratedClasses] = useState({});

  useEffect(() => {
    const initialParameters = {};
    students.forEach(student => {
      initialParameters[student.name] = {
        gender: student.gender || 'Unknown',
        academic: student.academic || 'Average',
        behaviour: student.behaviour || 'Good',
      };
    });
    setParameters(initialParameters);
  }, [students]);

  const handleStudentNamesInput = (e) => {
    const names = e.target.value.split('\n').map(name => ({ name: name.trim(), id: Date.now() + Math.random() }));
    setStudents(names.filter(student => student.name !== ''));
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
        setStudents(json.map((row, index) => ({
          name: row.Name || `Student ${index + 1}`,
          gender: row.Gender || 'Unknown',
          academic: row.Academic || 'Average',
          behaviour: row.Behaviour || 'Good',
          id: Date.now() + Math.random() + index
        })));
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

  const handleStudentParamChange = (studentName, param, value) => {
    setParameters(prev => ({
      ...prev,
      [studentName]: {
        ...prev[studentName],
        [param]: value,
      },
    }));
  };

  const handleAddFriendRequest = () => {
    setFriendRequests(prev => [...prev, { students: ['', ''], requestedBy: '' }]);
  };

  const handleFriendRequestChange = (index, field, value) => {
    const newRequests = [...friendRequests];
    if (field === 'student1' || field === 'student2') {
      newRequests[index].students = newRequests[index].students.map((s, i) => (i === (field === 'student1' ? 0 : 1) ? value : s));
    } else {
      newRequests[index][field] = value;
    }
    setFriendRequests(newRequests);
  };

  const handleDeleteFriendRequest = (index) => {
    setFriendRequests(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddSeparationRequest = () => {
    setSeparationRequests(prev => [...prev, { students: ['', ''], requestedBy: '' }]);
  };

  const handleSeparationRequestChange = (index, field, value) => {
    const newRequests = [...separationRequests];
    if (field === 'student1' || field === 'student2') {
      newRequests[index].students = newRequests[index].students.map((s, i) => (i === (field === 'student1' ? 0 : 1) ? value : s));
    } else {
      newRequests[index][field] = value;
    }
    setSeparationRequests(newRequests);
  };

  const handleDeleteSeparationRequest = (index) => {
    setSeparationRequests(prev => prev.filter((_, i) => i !== index));
  };

  const generateClasses = () => {
    const allStudents = students.map(s => ({ ...s, ...parameters[s.name] }));
    const classesByYear = {};

    Object.keys(yearLevels).forEach(year => {
      const numClasses = yearLevels[year];
      if (numClasses === 0) return;

      const yearStudents = allStudents; // Assuming all students are for one year level for simplicity, can be extended
      const availableStudents = [...yearStudents];
      const newClasses = Array.from({ length: numClasses }, () => ({
        students: [],
        stats: { gender: { Male: 0, Female: 0, Unknown: 0 }, academic: {}, behaviour: {} }
      }));

      // Prioritize friend requests
      friendRequests.forEach(req => {
        const s1 = availableStudents.find(s => s.name === req.students[0]);
        const s2 = availableStudents.find(s => s.name === req.students[1]);

        if (s1 && s2) {
          let assigned = false;
          for (const cls of newClasses) {
            if (cls.students.length + 2 <= classSizeRange.max) {
              cls.students.push(s1, s2);
              updateClassStats(cls, s1);
              updateClassStats(cls, s2);
              availableStudents.splice(availableStudents.indexOf(s1), 1);
              availableStudents.splice(availableStudents.indexOf(s2), 1);
              assigned = true;
              break;
            }
          }
          if (!assigned) {
            console.warn(`Could not place friend request for ${req.students[0]} and ${req.students[1]}`);
          }
        }
      });

      // Distribute remaining students
      while (availableStudents.length > 0) {
        const student = availableStudents.shift();
        let placed = false;
        for (const cls of newClasses) {
          if (cls.students.length < classSizeRange.max) {
            // Check separation requests
            const violatesSeparation = separationRequests.some(req =>
              (req.students.includes(student.name) && cls.students.some(s => req.students.includes(s.name)))
            );
            if (!violatesSeparation) {
              cls.students.push(student);
              updateClassStats(cls, student);
              placed = true;
              break;
            }
          }
        }
        if (!placed) {
          console.warn(`Could not place student ${student.name}. Class sizes might be too restrictive.`);
          // If a student cannot be placed, add them back to available to avoid infinite loop
          availableStudents.push(student);
          break;
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
      if (req.students.includes(studentName) && classStudents.some(s => req.students.includes(s.name) && s.name !== studentName)) {
        highlight = 'bg-blue-200'; // Friend pair
      }
    });
    // Check for separation issues (if a student is in class with someone they should be separated from)
    separationRequests.forEach(req => {
      if (req.students.includes(studentName) && classStudents.some(s => req.students.includes(s.name) && s.name !== studentName)) {
        highlight = 'bg-red-200'; // Separation violation (should not happen if generation logic is perfect)
      }
    });
    return highlight;
  };

  return (
    <div className="container mx-auto p-4 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Class Builder App</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Student Input */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Student Input</h2>
          <label htmlFor="studentNames" className="block text-gray-700 text-sm font-bold mb-2">
            Paste Student Names (one per line):
          </label>
          <textarea
            id="studentNames"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-4 h-32"
            placeholder="Alice Smith&#10;Bob Johnson&#10;Charlie Brown"
            onChange={handleStudentNamesInput}
          ></textarea>

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
          <p className="text-gray-600 text-xs mt-2">Expected columns: Name, Gender, Academic, Behaviour</p>
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

        {/* Student Parameters */}
        <div className="bg-white p-6 rounded-lg shadow-md max-h-96 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Student Individual Parameters</h2>
          {students.length === 0 && <p className="text-gray-500">Add students first to set parameters.</p>}
          {students.map(student => (
            <div key={student.id} className="mb-4 p-3 border rounded-md">
              <h3 className="font-medium text-gray-800">{student.name}</h3>
              <div className="flex flex-wrap gap-4 mt-2">
                <div>
                  <label className="block text-gray-700 text-xs font-bold mb-1">Gender:</label>
                  <select
                    value={parameters[student.name]?.gender || 'Unknown'}
                    onChange={(e) => handleStudentParamChange(student.name, 'gender', e.target.value)}
                    className="shadow border rounded py-1 px-2 text-gray-700 text-sm"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-xs font-bold mb-1">Academic:</label>
                  <select
                    value={parameters[student.name]?.academic || 'Average'}
                    onChange={(e) => handleStudentParamChange(student.name, 'academic', e.target.value)}
                    className="shadow border rounded py-1 px-2 text-gray-700 text-sm"
                  >
                    <option value="High">High</option>
                    <option value="Average">Average</option>
                    <option value="Low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 text-xs font-bold mb-1">Behaviour:</label>
                  <select
                    value={parameters[student.name]?.behaviour || 'Good'}
                    onChange={(e) => handleStudentParamChange(student.name, 'behaviour', e.target.value)}
                    className="shadow border rounded py-1 px-2 text-gray-700 text-sm"
                  >
                    <option value="Excellent">Excellent</option>
                    <option value="Good">Good</option>
                    <option value="Needs Support">Needs Support</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Friend Requests */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Friend Requests (Paired)</h2>
        {friendRequests.map((req, index) => (
          <div key={index} className="flex flex-wrap items-center gap-4 mb-3 p-3 border rounded-md relative">
            <select
              value={req.students[0]}
              onChange={(e) => handleFriendRequestChange(index, 'student1', e.target.value)}
              className="shadow border rounded py-1 px-2 text-gray-700 text-sm flex-1 min-w-[120px]"
            >
              <option value="">Select Student 1</option>
              {students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <span className="text-gray-600">and</span>
            <select
              value={req.students[1]}
              onChange={(e) => handleFriendRequestChange(index, 'student2', e.target.value)}
              className="shadow border rounded py-1 px-2 text-gray-700 text-sm flex-1 min-w-[120px]"
            >
              <option value="">Select Student 2</option>
              {students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <input
              type="text"
              value={req.requestedBy}
              onChange={(e) => handleFriendRequestChange(index, 'requestedBy', e.target.value)}
              className="shadow appearance-none border rounded py-1 px-2 text-gray-700 text-sm flex-1 min-w-[150px]"
              placeholder="Requested by (Parent/Teacher)"
            />
            <button
              onClick={() => handleDeleteFriendRequest(index)}
              className="ml-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline text-sm"
            >
              Delete
            </button>
          </div>
        ))}
        <button
          onClick={handleAddFriendRequest}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-4"
        >
          Add Friend Request
        </button>
      </div>

      {/* Separation Requests */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Separation Requests</h2>
        {separationRequests.map((req, index) => (
          <div key={index} className="flex flex-wrap items-center gap-4 mb-3 p-3 border rounded-md relative">
            <select
              value={req.students[0]}
              onChange={(e) => handleSeparationRequestChange(index, 'student1', e.target.value)}
              className="shadow border rounded py-1 px-2 text-gray-700 text-sm flex-1 min-w-[120px]"
            >
              <option value="">Select Student 1</option>
              {students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <span className="text-gray-600">and</span>
            <select
              value={req.students[1]}
              onChange={(e) => handleSeparationRequestChange(index, 'student2', e.target.value)}
              className="shadow border rounded py-1 px-2 text-gray-700 text-sm flex-1 min-w-[120px]"
            >
              <option value="">Select Student 2</option>
              {students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <input
              type="text"
              value={req.requestedBy}
              onChange={(e) => handleSeparationRequestChange(index, 'requestedBy', e.target.value)}
              className="shadow appearance-none border rounded py-1 px-2 text-gray-700 text-sm flex-1 min-w-[150px]"
              placeholder="Requested by (Parent/Teacher)"
            />
            <button
              onClick={() => handleDeleteSeparationRequest(index)}
              className="ml-2 bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded focus:outline-none focus:shadow-outline text-sm"
            >
              Delete
            </button>
          </div>
        ))}
        <button
          onClick={handleAddSeparationRequest}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline mt-4"
        >
          Add Separation Request
        </button>
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
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gender</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Academic</th>
                          <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Behaviour</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {cls.students.map(student => (
                          <tr key={student.id} className={getFriendSeparationHighlight(student.name, cls.students)}>
                            <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                            <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{student.gender}</td>
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

const express = require('express')
const bodyParser = require('body-parser');
const connection = require('./dbconfig')
const app = express()
app.use(express.json())
const cors = require('cors');
app.use(cors());
app.use(bodyParser.json()); // This line ensures JSON bodies are parsed

// INSERT Quarter Task Details

app.post('/create_quarter_task', async (req, res) => {
  const { company_id, financial_year, emp_code, staffid, quarter_no, created_by, goals } = req.body;

  if (goals.length == 0) {
    res.status(200).json({ success: false, message: 'Sorry ! No Goal Data Found.', alert_type: 'error' });
  } else {
    try {
      for (const goal of goals) {
        const { goal_title, kpi_data } = goal;

        // Insert into hrms_prm_task_title
        let insertTitleQuery = 'INSERT INTO hrms_prm_task_title (company_id, financial_year, emp_code, staffid, quarter_no, goal_title, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)';
        let titleResult;

        try {
          titleResult = await new Promise((resolve, reject) => {
            connection.query(insertTitleQuery, [company_id, financial_year, emp_code, staffid, quarter_no, goal_title, created_by], (err, result) => {
              if (err) return reject(err);
              resolve(result);
            });
          });

          console.log('Title Insert Result:', titleResult);
        } catch (queryError) {
          console.error('Error during title insertion:', queryError);
          return res.status(500).send('Error inserting title.');
        }

        const title_id = titleResult.insertId;
        console.log('Inserted title_id:', title_id);

        // Insert kpi_details
        for (const kpi of kpi_data) {
          const { kpi_detail, uom, total_target, kpi_target } = kpi;

          if (!uom || uom === 'Select UOM') {
            return res.status(400).json({ success: false, message: 'UOM is not selected', alert_type: 'danger' });
          }

          let kpiResult;

          try {
            kpiResult = await new Promise((resolve, reject) => {
              connection.query(
                'INSERT INTO hrms_prm_task_title_details (company_id, financial_year, emp_code, staffid, goal_id, goal_task, uom, total_target,created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [company_id, financial_year, emp_code, staffid, title_id, kpi_detail, uom, total_target, created_by],
                (err, result) => {
                  if (err) return reject(err);
                  resolve(result);
                }
              );
            });

            const kpi_id = kpiResult.insertId;
            console.log('Inserted kpi_id:', kpi_id);

            // Insert kpi_target
            for (const target of kpi_target) {
              try {
                await new Promise((resolve, reject) => {
                  connection.query(
                    'INSERT INTO hrms_prm_kpi_target_achievement (company_id, financial_year, emp_code, staffid, kpi_id, review_month, target, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [company_id, financial_year, emp_code, staffid, kpi_id, target.month, target.target, created_by],
                    (err, result) => {
                      if (err) return reject(err);
                      resolve(result);
                    }
                  );
                });
              } catch (queryError) {
                console.error('Error during KPI target insertion:', queryError);
                return res.status(500).send('Error inserting KPI target details.');
              }
            }
          } catch (queryError) {
            console.error('Error during task details insertion:', queryError);
            return res.status(500).send('Error inserting task details.');
          }
        }
      }

      res.status(200).json({ success: true, message: 'Goals and KPI targets added successfully.', alert_type: 'success' });
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).send('Unexpected error.');
    }
  }
});


// GET Quarter Month Details

app.get('/get_quarterly_month_data', (req, resp) => {
  let sqlquery = `
    SELECT value2 
    FROM hrms_general_settings 
    WHERE value = ?
  `;

  connection.query(sqlquery, [req.query.quarterId], (err, result) => {
    if (err) {
      console.error('Error connection:', err); // Log the error
      resp.status(500).send('Error connecting to the database');
    } else {
      if (result.length > 0) {
        let jsonData = result[0].value2; // Assuming value2 contains the JSON string
        try {
          let parsedData = JSON.parse(jsonData); // Parse the JSON string into an object
          resp.json(parsedData);
        } catch (parseError) {
          console.error('JSON parse error:', parseError); // Log parse error
          resp.status(500).send('Error parsing data');
        }
      } else {
        resp.status(404).send('No data found');
      }
    }
  });
});


// GET Goal and KPI Details

app.get('/fetch_goals', (req, res) => {
  const { company_id, financial_year, emp_code, staffid, quarter_no } = req.query;


  let goalQuery = `
  SELECT *
    FROM hrms_prm_task_title 
    WHERE company_id = ? AND financial_year = ? AND emp_code = ? AND staffid = ? AND quarter_no = ?
    `;

  connection.query(goalQuery, [company_id, financial_year, emp_code, staffid, quarter_no], (err, goals) => {
    if (err) {
      console.error('Error fetching goals:', err);
      return res.status(500).send('Error fetching goals.');
    }

    if (goals.length === 0) {
      // Send an empty array if no goals are found
      return res.status(200).json([]);
    }

    // Extract goal IDs to fetch related data
    const goalIds = goals.map(goal => goal.id); // Adjust the property if the primary key is named differently

    let kpiDetailsQuery = `
      SELECT *
    FROM hrms_prm_task_title_details 
      WHERE goal_id IN(?)
    `;

    connection.query(kpiDetailsQuery, [goalIds], (err, kpiDetails) => {
      if (err) {
        console.error('Error fetching KPI details:', err);
        return res.status(500).send('Error fetching KPI details.');
      }

      const kpiIds = kpiDetails.map(detail => detail.id); // Adjust the property if the primary key is named differently

      let kpiTargetsQuery = `
  SELECT *
    FROM hrms_prm_kpi_target_achievement 
        WHERE kpi_id IN(?) 
        ORDER BY id ASC
    `;

      connection.query(kpiTargetsQuery, [kpiIds], (err, kpiTargets) => {
        if (err) {
          console.error('Error fetching KPI targets:', err);
          return res.status(500).send('Error fetching KPI targets.');
        }

        // Combine results
        const results = goals.map(goal => {
          return {
            ...goal,
            kpi_data: kpiDetails
              .filter(detail => detail.goal_id === goal.id)
              .map(detail => {
                return {
                  ...detail,
                  kpi_target: kpiTargets.filter(target => target.kpi_id === detail.id)
                };
              })
          };
        });

        res.status(200).json(results);
      });
    });
  });
});

// UPDATE KPI Achievements


const isMultipleOf3 = (num) => num % 3 === 0;

app.put('/update_balance_kpiTarget', (req, res) => {
  const kpiId = parseInt(req.query.kpiId, 10); // Convert kpiId to number
  const nextKpiId = parseInt(req.query.next_kpi_id, 10); // Convert nextKpiId to number
  const { achieved, target } = req.body;

  if (isNaN(kpiId) || isNaN(nextKpiId) || achieved === undefined || target === undefined) {
    return res.status(400).json({ error: 'Invalid or missing required fields' });
  }

  // Update achieved value for current kpiId
  let updateAchievedQuery = 'UPDATE hrms_prm_kpi_target_achievement SET achieved = ? WHERE id = ?';
  connection.query(updateAchievedQuery, [achieved, kpiId], (err, results) => {
    if (err) {
      console.error('Error updating achieved value:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'kpiId not found' });
    }

    // Check if kpiId is not a multiple of 3 before updating next_kpi_id
    if (!isMultipleOf3(kpiId)) {
      // Update target value for next_kpi_id
      let updateTargetQuery = 'UPDATE hrms_prm_kpi_target_achievement SET target = ? WHERE id = ?';
      connection.query(updateTargetQuery, [target, nextKpiId], (err, results) => {
        if (err) {
          console.error('Error updating target value:', err);
          return res.status(500).json({ error: 'Database error' });
        }

        if (results.affectedRows === 0) {
          return res.status(404).json({ error: 'next_kpi_id not found' });
        }

        res.status(200).json({ success: true, message: 'Data Updated Successfully', alert_type: 'success' });
      });
    } else {
      res.status(200).json({ success: true, message: 'Achieved value updated, no target update needed', alert_type: 'info' });
    }
  });
});

// FETCH KPI Data by ID

app.get('/fetch_kpi_data_byId', (req, res) => {
  const kpiId = req.query.kpiId;
  const nextKpiId = req.query.next_kpi_id;

  if (!kpiId || !nextKpiId) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  // First query to fetch the achieved field using kpiId
  let achievedQuery = 'SELECT achieved FROM hrms_prm_kpi_target_achievement WHERE id = ?';
  connection.query(achievedQuery, [kpiId], (err, achievedResults) => {
    if (err) {
      console.error('Database error (achieved query): ', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (achievedResults.length === 0) {
      return res.status(404).json({ error: 'KPI data not found for the provided kpiId' });
    }

    // Second query to fetch the target field using next_kpi_id
    let targetQuery = 'SELECT target FROM hrms_prm_kpi_target_achievement WHERE id = ?';
    connection.query(targetQuery, [nextKpiId], (err, targetResults) => {
      if (err) {
        console.error('Database error (target query): ', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (targetResults.length === 0) {
        return res.status(404).json({ error: 'KPI data not found for the provided next_kpi_id' });
      }

      // Respond with both achieved and target data
      res.status(200).json({
        achieved: achievedResults[0].achieved,
        target: targetResults[0].target
      });
    });
  });
});


// PUT route to update comment
app.put('/update_kpi_comment_achieved', (req, res) => {
  const kpiId = req.query.kpiId;
  const { comment } = req.body;

  if (!kpiId || !comment) {
    return res.status(400).json({ error: 'Missing kpiId or comment' });
  }

  let updateCommentQuery = `
    UPDATE hrms_prm_kpi_target_achievement
    SET comment = ?
    WHERE id = ?
  `;

  connection.query(updateCommentQuery, [comment, kpiId], (err, results) => {
    if (err) {
      console.error('Error updating comment:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'kpiId not found' });
    }

    res.status(200).json({ success: true, message: 'Comment updated successfully', alert_type: 'success' });
  });
});

app.listen(5000)
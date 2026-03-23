using System;
using Microsoft.Data.SqlClient;

class Program
{
    static void Main(string[] args)
    {
        try
        {
            // Safety 1: Run only on 1st day of month
            if (DateTime.Now.Day != 1)
            {
                Console.WriteLine("Not 1st day of month. Skipping...");
                return;
            }

            string connectionString = "Server=103.230.85.44;Database=Employeesreport;User Id=sa;Password=V9%2f+?b$H%9d;MultipleActiveResultSets=true;TrustServerCertificate=True;";

            using (var con = new SqlConnection(connectionString))
            {
                con.Open();

                string insertQuery = @"
INSERT INTO Tasks
    (TaskName, Description, AssignedTo, AssignedBy, StartDate, DueDate,
     Priority, Status, IsRecurring, RecurrenceType, ParentTaskId, CreatedAt)
SELECT
    t.TaskName,
    t.Description,
    t.AssignedTo,
    t.AssignedBy,
    DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1),
    EOMONTH(GETDATE()),
    t.Priority,
    'Pending',
    t.IsRecurring,
    t.RecurrenceType,
    ISNULL(t.ParentTaskId, t.Id),
    GETDATE()
FROM Tasks t
WHERE t.IsRecurring = 1
  AND t.RecurrenceType = 'monthly'
  -- Only completed tasks
  AND t.Status = 'completed'
  -- SQL-level 1st-day protection
  AND DAY(GETDATE()) = 1
  -- Strict previous month only
  AND t.StartDate >= DATEADD(MONTH, -1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
  AND t.StartDate <  DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
  -- Block future/wrong data
  AND t.StartDate < GETDATE()
  -- Strong duplicate prevention
  AND NOT EXISTS (
      SELECT 1 FROM Tasks t2
      WHERE t2.AssignedTo = t.AssignedTo
        AND t2.TaskName   = t.TaskName
        AND t2.StartDate >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
        AND t2.StartDate <  DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
  );";

                using (SqlCommand cmd = new SqlCommand(insertQuery, con))
                {
                    int rows = cmd.ExecuteNonQuery();
                    Console.WriteLine($"Monthly tasks created: {rows}");
                }

                con.Close();
            }

            Console.WriteLine("Task generation completed successfully.");
        }
        catch (Exception ex)
        {
            Console.WriteLine("Error: " + ex.Message);
        }
    }
}

import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { apiFetch } from '../../lib/api';
import { Download } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
} from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const mono: React.CSSProperties = { fontFamily: "'JetBrains Mono', monospace" };
const display: React.CSSProperties = { fontFamily: "'Barlow Condensed', sans-serif" };

// Role-based chart visibility config
const ROLE_CHARTS = {
  ADMIN: ['fleet', 'trips', 'financial', 'drivers', 'maintenance', 'summary'],
  FLEET_MANAGER: ['fleet', 'trips', 'maintenance', 'summary'],
  SAFETY_OFFICER: ['drivers', 'summary'],
  FINANCIAL_ANALYST: ['financial', 'trips', 'summary'],
};

const COLORS = {
  AVAILABLE: '#10b981',
  ON_TRIP: '#3b82f6',
  IN_SHOP: '#f59e0b',
  RETIRED: '#64748b',
  SUSPENDED: '#ef4444',
  OFF_DUTY: '#9ca3af',
  DRAFT: '#6366f1',
  DISPATCHED: '#3b82f6',
  COMPLETED: '#10b981',
  CANCELLED: '#ef4444',
};

const getColorForStatus = (status: string): string => {
  return COLORS[status as keyof typeof COLORS] || '#8884d8';
};

// Role-based descriptions
const ROLE_DESCRIPTIONS = {
  ADMIN: 'Full access to all fleet operations, financial, and safety data.',
  FLEET_MANAGER: 'Fleet utilization, vehicle status, maintenance, and trip tracking.',
  SAFETY_OFFICER: 'Driver safety scores, status breakdown, and performance metrics.',
  FINANCIAL_ANALYST: 'Revenue, expenses, fuel costs, and trip profitability analysis.',
};

export default function Analytics() {
  const { user } = useAuth();
  const { isNight } = useTheme();
  const [fleetData, setFleetData] = useState<any[]>([]);
  const [tripData, setTripData] = useState<any[]>([]);
  const [financialData, setFinancialData] = useState<any[]>([]);
  const [driverStatusData, setDriverStatusData] = useState<any[]>([]);
  const [driverSafetyData, setDriverSafetyData] = useState<any[]>([]);
  const [maintenanceData, setMaintenanceData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const chartsRef = useRef<HTMLDivElement>(null);

  const userRole = user?.role as keyof typeof ROLE_CHARTS || 'ADMIN';
  const visibleCharts = ROLE_CHARTS[userRole] || [];
  
  // Dynamic text color based on theme
  const textColor = isNight ? '#f0f0f0' : '#000000';
  const gridColor = isNight ? '#333333' : '#e0e0e0';

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const promises = [];

        if (visibleCharts.includes('fleet')) promises.push(apiFetch('/api/analytics/fleet'));
        if (visibleCharts.includes('trips')) promises.push(apiFetch('/api/analytics/trips'));
        if (visibleCharts.includes('financial')) promises.push(apiFetch('/api/analytics/financial'));
        if (visibleCharts.includes('drivers')) promises.push(apiFetch('/api/analytics/drivers'));
        if (visibleCharts.includes('maintenance')) promises.push(apiFetch('/api/analytics/maintenance'));
        if (visibleCharts.includes('summary')) promises.push(apiFetch('/api/analytics/summary'));

        const results = await Promise.all(promises);
        let resultIndex = 0;

        if (visibleCharts.includes('fleet')) {
          const data = results[resultIndex++]?.fleetData || [];
          console.log('Fleet data:', data);
          setFleetData(data);
        }
        if (visibleCharts.includes('trips')) {
          const data = results[resultIndex++]?.tripData || [];
          console.log('Trip data:', data);
          setTripData(data);
        }
        if (visibleCharts.includes('financial')) {
          const data = results[resultIndex++]?.financialData || [];
          console.log('Financial data:', data);
          setFinancialData(data);
        }
        if (visibleCharts.includes('drivers')) {
          const driverResult = results[resultIndex++];
          console.log('Driver result:', driverResult);
          setDriverStatusData(driverResult?.driverStatusData || []);
          setDriverSafetyData(driverResult?.driverSafetyData || []);
        }
        if (visibleCharts.includes('maintenance')) {
          const data = results[resultIndex++]?.maintenanceData || [];
          console.log('Maintenance data:', data);
          setMaintenanceData(data);
        }
        if (visibleCharts.includes('summary')) {
          const data = results[resultIndex++]?.summary || {};
          console.log('Summary data:', data);
          setSummary(data);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [visibleCharts]);

  if (loading) {
    return (
      <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto">
        <p style={{ color: 'var(--muted-foreground)' }}>Loading analytics...</p>
      </div>
    );
  }

  // Prepare Fleet Status Chart
  const fleetChartData = {
    labels: fleetData.map(d => d.status),
    datasets: [{
      label: 'Fleet Status',
      data: fleetData.map(d => d.count),
      backgroundColor: fleetData.map(d => getColorForStatus(d.status)),
      borderColor: 'var(--border)',
      borderWidth: 0.5,
    }]
  };

  // Prepare Driver Status Chart
  const driverChartData = {
    labels: driverStatusData.map(d => d.status),
    datasets: [{
      label: 'Driver Status',
      data: driverStatusData.map(d => d.count),
      backgroundColor: driverStatusData.map(d => getColorForStatus(d.status)),
      borderColor: 'var(--border)',
      borderWidth: 0.5,
    }]
  };

  // Prepare Driver Safety Chart
  const safetyChartData = {
    labels: driverSafetyData.map(d => d.score_category),
    datasets: [{
      label: 'Drivers',
      data: driverSafetyData.map(d => d.count),
      backgroundColor: '#f59e0b',
      borderColor: 'var(--border)',
      borderWidth: 0.5,
    }]
  };

  // Prepare Trip Status Chart
  const tripChartData = {
    labels: tripData.map(d => d.status),
    datasets: [{
      label: 'Trip Count',
      data: tripData.map(d => d.count),
      backgroundColor: tripData.map(d => getColorForStatus(d.status)),
      borderColor: 'var(--border)',
      borderWidth: 0.5,
    }]
  };

  // Prepare Financial Chart
  const financialChartData = {
    labels: financialData.map(d => d.category),
    datasets: [{
      label: 'Amount ($)',
      data: financialData.map(d => d.amount),
      backgroundColor: '#10b981',
      borderColor: 'var(--border)',
      borderWidth: 0.5,
    }]
  };

  // Prepare Maintenance Chart
  const maintenanceChartData = {
    labels: maintenanceData.map(d => d.status),
    datasets: [
      {
        label: 'Count',
        data: maintenanceData.map(d => d.count),
        backgroundColor: '#3b82f6',
        borderColor: 'var(--border)',
        borderWidth: 0.5,
        yAxisID: 'y',
      },
      {
        label: 'Cost ($)',
        data: maintenanceData.map(d => parseFloat(d.total_cost || 0)),
        backgroundColor: '#f59e0b',
        borderColor: 'var(--border)',
        borderWidth: 0.5,
        yAxisID: 'y1',
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.8,
    plugins: {
      legend: {
        labels: {
          color: textColor,
          font: { family: "'Inter', sans-serif", size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'var(--card)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        borderColor: 'var(--border)',
        borderWidth: 0.5,
      }
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { size: 11 } },
        grid: { color: gridColor },
        title: {
          display: true,
          text: 'Category',
          color: textColor,
          font: { size: 12, weight: 'bold' }
        }
      },
      y: {
        ticks: { color: textColor, font: { size: 11 } },
        grid: { color: gridColor },
        title: {
          display: true,
          text: 'Count',
          color: textColor,
          font: { size: 12, weight: 'bold' }
        }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        ticks: { color: textColor, font: { size: 11 } },
        grid: { drawOnChartArea: false },
        title: {
          display: true,
          text: 'Cost ($)',
          color: textColor,
          font: { size: 12, weight: 'bold' }
        }
      }
    }
  };

  // PDF Download Function
  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Add background color - light gray
      pdf.setFillColor(250, 250, 250);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      
      // Add header background
      pdf.setFillColor(245, 245, 245);
      pdf.rect(0, 0, pageWidth, 45, 'F');
      
      // Add border
      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.5);
      pdf.line(0, 45, pageWidth, 45);
      
      // Reset text color for content
      pdf.setTextColor(15, 15, 15);
      
      // Add title
      pdf.setFontSize(20);
      pdf.setFont(undefined, 'bold');
      pdf.text('Analytics Report', 15, 18);
      
      // Add metadata
      pdf.setFontSize(9);
      pdf.setFont(undefined, 'normal');
      pdf.setTextColor(90, 90, 90);
      
      const now = new Date();
      const dateTime = now.toLocaleString('en-IN', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      });
      
      pdf.text(`Downloaded by: ${user?.name || 'N/A'}`, 15, 28);
      pdf.text(`Date & Time: ${dateTime}`, 15, 33);
      pdf.text(`Role: ${userRole}`, 15, 38);
      
      let yPosition = 55;
      
      // Capture and add charts
      if (chartsRef.current) {
        const chartElements = chartsRef.current.querySelectorAll('[data-chart]');
        const chartsPerPage = 2;
        let chartsOnCurrentPage = 0;
        
        for (let i = 0; i < chartElements.length; i++) {
          const element = chartElements[i];
          
          // Add new page if needed
          if (chartsOnCurrentPage === 0) {
          if (i > 0) {
            pdf.addPage();
            // Add background to new pages
            pdf.setFillColor(250, 250, 250);
            pdf.rect(0, 0, pageWidth, pageHeight, 'F');
            yPosition = 15;
          } else {
            // First page: yPosition is already set to 55 (after header)
            yPosition = 55;
          }
          }
          
          try {
          const canvas = await html2canvas(element as HTMLElement, {
            scale: 2,
            backgroundColor: '#ffffff'
          });
          const imgData = canvas.toDataURL('image/png');
            
          // Calculate chart dimensions to fit 2 per page
          const availableHeight = (pageHeight - 30) / chartsPerPage; // 30mm margin, divide by 2 charts
          const maxChartWidth = pageWidth - 30; // 15mm margins on each side
            
          // Calculate aspect ratio to maintain proportions
          const aspectRatio = canvas.width / canvas.height;
          let imgWidth = maxChartWidth;
          let imgHeight = imgWidth / aspectRatio;
            
          // If height is too large, scale by height instead
          if (imgHeight > availableHeight - 5) {
            imgHeight = availableHeight - 5;
            imgWidth = imgHeight * aspectRatio;
          }
            
          // Add chart image centered
          const xOffset = (pageWidth - imgWidth) / 2;
          pdf.addImage(imgData, 'PNG', xOffset, yPosition, imgWidth, imgHeight);
            
          yPosition += imgHeight + 5;
          chartsOnCurrentPage++;
            
          // Reset for new page after 2 charts
          if (chartsOnCurrentPage === chartsPerPage) {
            chartsOnCurrentPage = 0;
          }
          } catch (error) {
          console.error('Error capturing chart:', error);
          }
        }
      }
      
      // Save PDF
      pdf.save(`Analytics_Report_${user?.name?.replace(/\s+/g, '_')}_${Date.now()}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1400px] mx-auto">
      {/* Header with Download Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
        <div>
          <div style={{ ...mono, fontSize: '0.6rem', letterSpacing: '0.2em', color: 'var(--muted-foreground)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
            {userRole} Analytics · Dashboard
          </div>
          <h1 style={{ ...display, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--foreground)' }}>
            Data Visualization
          </h1>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '0.85rem', marginBottom: '0' }}>
            {ROLE_DESCRIPTIONS[userRole] || 'Comprehensive fleet analytics.'}
          </p>
        </div>
        
        {/* Download Button */}
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: 'var(--primary)',
            color: isNight ? '#000' : '#fff',
            border: 'none',
            borderRadius: '0',
            cursor: downloading ? 'not-allowed' : 'pointer',
            opacity: downloading ? 0.6 : 1,
            fontSize: '0.9rem',
            fontWeight: 600,
            transition: 'opacity 0.2s'
          }}
        >
          <Download size={18} />
          {downloading ? 'Downloading...' : 'Download PDF'}
        </button>
      </div>

      {/* Key Metrics */}
      {visibleCharts.includes('summary') && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-8" style={{ background: 'var(--border)', border: '1px solid var(--border)' }}>
          <MetricCard label="Total Vehicles" value={summary.totalVehicles || 0} />
          <MetricCard label="Active Drivers" value={summary.totalDrivers || 0} />
          <MetricCard label="Completed Trips" value={summary.completedTrips || 0} />
          <MetricCard label="Avg Safety Score" value={`${summary.avgSafetyScore || 0}/100`} />
        </div>
      )}

      {/* Charts Grid */}
      <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Fleet Status Doughnut Chart */}
        {visibleCharts.includes('fleet') && fleetData.length > 0 && (
          <div data-chart="fleet-status">
            <ChartCard title="Fleet Status Distribution">
              <Doughnut data={fleetChartData} options={chartOptions} />
            </ChartCard>
          </div>
        )}

        {/* Trip Status Bar Chart */}
        {visibleCharts.includes('trips') && tripData.length > 0 && (
          <div data-chart="trip-status">
            <ChartCard title="Trip Status Overview">
              <Bar data={tripChartData} options={chartOptions} />
            </ChartCard>
          </div>
        )}

        {/* Financial Bar Chart */}
        {visibleCharts.includes('financial') && financialData.length > 0 && (
          <div data-chart="financial">
            <ChartCard title="Financial Summary">
              <Bar data={financialChartData} options={chartOptions} />
            </ChartCard>
          </div>
        )}

        {/* Driver Status Doughnut Chart */}
        {visibleCharts.includes('drivers') && driverStatusData.length > 0 && (
          <div data-chart="driver-status">
            <ChartCard title="Driver Status Breakdown">
              <Doughnut data={driverChartData} options={chartOptions} />
            </ChartCard>
          </div>
        )}

        {/* Driver Safety Bar Chart */}
        {visibleCharts.includes('drivers') && driverSafetyData.length > 0 && (
          <div data-chart="driver-safety">
            <ChartCard title="Driver Safety Scores">
              <Bar data={safetyChartData} options={chartOptions} />
            </ChartCard>
          </div>
        )}

        {/* Maintenance Chart */}
        {visibleCharts.includes('maintenance') && maintenanceData.length > 0 && (
          <div data-chart="maintenance">
            <ChartCard title="Maintenance Logs">
              <Bar data={maintenanceChartData} options={{...chartOptions, scales: {...chartOptions.scales}}} />
            </ChartCard>
          </div>
        )}
      </div>

      {/* Data Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleCharts.includes('fleet') && fleetData.length > 0 && (
          <DataTable title="Fleet Status Details" data={fleetData} columns={['status', 'count']} />
        )}
        {visibleCharts.includes('maintenance') && maintenanceData.length > 0 && (
          <DataTable title="Maintenance Details" data={maintenanceData} columns={['status', 'count', 'total_cost']} />
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '1rem', backgroundColor: 'var(--card)', borderRight: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--foreground)' }}>
        {value}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function DataTable({ title, data, columns }: { title: string; data: any[]; columns: string[] }) {
  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', padding: '1.5rem' }}>
      <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--foreground)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map((col) => (
              <th
                key={col}
                style={{
                  padding: '0.75rem',
                  textAlign: 'left',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--muted-foreground)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {col.replace(/_/g, ' ')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
              {columns.map((col) => (
                <td
                  key={col}
                  style={{
                    padding: '0.75rem',
                    fontSize: '0.85rem',
                    color: 'var(--foreground)',
                  }}
                >
                  {col === 'total_cost'
                    ? `$${parseFloat(row[col] || 0).toFixed(2)}`
                    : row[col]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

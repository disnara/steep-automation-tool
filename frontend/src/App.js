import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { ScrollArea } from "./components/ui/scroll-area";
import { Separator } from "./components/ui/separator";
import { Progress } from "./components/ui/progress";
import { Alert, AlertDescription } from "./components/ui/alert";
import { 
  Play, 
  Square, 
  RefreshCw, 
  Trash2, 
  Settings, 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock,
  Users,
  Target,
  Activity,
  Download,
  Github,
  Infinity
} from "lucide-react";
import { Switch } from "./components/ui/switch";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AutomationTool = () => {
  const [config, setConfig] = useState({
    batch_size: 15,
    cooldown_minutes: 15,
    email_check_interval: 10,
    referral_code: "Cook",
    continuous_mode: true
  });

  const [status, setStatus] = useState({
    is_running: false,
    accounts_created: 0,
    total_accounts: 0,
    current_batch: 0,
    last_batch_time: null,
    stats: {
      successful_signups: 0,
      verified_accounts: 0,
      failed_attempts: 0
    }
  });

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch status and logs periodically
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, logsRes] = await Promise.all([
          axios.get(`${API}/automation/status`),
          axios.get(`${API}/automation/logs?limit=100`)
        ]);
        
        setStatus(statusRes.data);
        setLogs(logsRes.data.logs);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 2000); // Update every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const startAutomation = async () => {
    try {
      setLoading(true);
      await axios.post(`${API}/automation/start`, config);
    } catch (error) {
      console.error("Error starting automation:", error);
      alert(error.response?.data?.detail || "Failed to start automation");
    } finally {
      setLoading(false);
    }
  };

  const stopAutomation = async () => {
    try {
      setLoading(true);
      await axios.post(`${API}/automation/stop`);
    } catch (error) {
      console.error("Error stopping automation:", error);
      alert(error.response?.data?.detail || "Failed to stop automation");
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      await axios.delete(`${API}/automation/logs`);
      setLogs([]);
    } catch (error) {
      console.error("Error clearing logs:", error);
    }
  };

  const downloadSourceCode = async () => {
    try {
      const response = await axios.get(`${API}/download-source`, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const blob = new Blob([response.data], { type: 'application/zip' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'steep-automation-tool.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading source code:", error);
      alert("Error downloading source code");
    }
  };

  const getLogLevelColor = (level) => {
    switch (level.toLowerCase()) {
      case 'success': return 'bg-emerald-500';
      case 'error': return 'bg-rose-500';
      case 'warning': return 'bg-amber-500';
      default: return 'bg-blue-500';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const calculateProgress = () => {
    if (config.continuous_mode) {
      // For continuous mode, show progress within current batch
      const currentBatchProgress = status.accounts_created % config.batch_size;
      return (currentBatchProgress / config.batch_size) * 100;
    } else {
      if (status.total_accounts === 0) return 0;
      return (status.accounts_created / status.total_accounts) * 100;
    }
  };

  const calculateSuccessRate = () => {
    const total = status.stats.successful_signups + status.stats.failed_attempts;
    if (total === 0) return 0;
    return ((status.stats.verified_accounts / total) * 100).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Steep.gg Waitlist Automation
            </h1>
            <p className="text-slate-400 text-lg">
              Automated signup and email verification system
            </p>
          </div>
          
          <div className="flex justify-center space-x-3">
            <Button 
              onClick={downloadSourceCode}
              variant="outline" 
              className="bg-slate-700 border-slate-600 hover:bg-slate-600"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Source Code
            </Button>
            <Button 
              variant="outline" 
              className="bg-slate-700 border-slate-600 hover:bg-slate-600"
              onClick={() => window.open('https://github.com', '_blank')}
            >
              <Github className="h-4 w-4 mr-2" />
              View on GitHub
            </Button>
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-sm text-slate-400">Accounts Created</p>
                  <p className="text-2xl font-bold text-white">{status.accounts_created}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-8 w-8 text-emerald-400" />
                <div>
                  <p className="text-sm text-slate-400">Verified</p>
                  <p className="text-2xl font-bold text-white">{status.stats.verified_accounts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Target className="h-8 w-8 text-amber-400" />
                <div>
                  <p className="text-sm text-slate-400">Success Rate</p>
                  <p className="text-2xl font-bold text-white">{calculateSuccessRate()}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-8 w-8 text-rose-400" />
                <div>
                  <p className="text-sm text-slate-400">Failed</p>
                  <p className="text-2xl font-bold text-white">{status.stats.failed_attempts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress */}
        {(status.total_accounts > 0 || config.continuous_mode) && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">
                    {config.continuous_mode ? "Current Batch Progress" : "Overall Progress"}
                  </span>
                  <span className="text-white">
                    {config.continuous_mode 
                      ? `${status.accounts_created % config.batch_size} / ${config.batch_size} accounts`
                      : `${status.accounts_created} / ${status.total_accounts} accounts`
                    }
                  </span>
                </div>
                <Progress value={calculateProgress()} className="h-2" />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Batch {status.current_batch}</span>
                  <span>
                    {config.continuous_mode 
                      ? `${calculateProgress().toFixed(1)}% of current batch`
                      : `${calculateProgress().toFixed(1)}% Complete`
                    }
                  </span>
                </div>
                {config.continuous_mode && (
                  <div className="mt-2 p-2 bg-slate-700/50 rounded text-center">
                    <span className="text-emerald-400 font-medium text-sm">
                      🔁 Continuous Mode: Running indefinitely
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="control" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-slate-800">
            <TabsTrigger value="control" className="data-[state=active]:bg-slate-700">
              Control Panel
            </TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-slate-700">
              Live Logs
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-slate-700">
              Configuration
            </TabsTrigger>
          </TabsList>

          {/* Control Panel */}
          <TabsContent value="control">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center space-x-2">
                    <Settings className="h-5 w-5" />
                    <span>Automation Control</span>
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Start or stop the automation process
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Badge variant={status.is_running ? "default" : "secondary"}>
                      {status.is_running ? "RUNNING" : "STOPPED"}
                    </Badge>
                    {status.is_running && (
                      <Badge variant="outline" className="text-amber-400 border-amber-400">
                        <Clock className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="flex space-x-2">
                    <Button 
                      onClick={startAutomation}
                      disabled={status.is_running || loading}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Automation
                    </Button>
                    <Button 
                      onClick={stopAutomation}
                      disabled={!status.is_running || loading}
                      variant="destructive"
                      className="flex-1"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </div>

                  {status.last_batch_time && (
                    <Alert className="bg-slate-700/50 border-slate-600">
                      <Clock className="h-4 w-4" />
                      <AlertDescription className="text-slate-300">
                        Last batch started: {formatTimestamp(status.last_batch_time)}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Current Configuration</CardTitle>
                  <CardDescription className="text-slate-400">
                    Active automation settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Batch Size:</span>
                      <span className="text-white ml-2">{config.batch_size}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Mode:</span>
                      <span className="text-white ml-2">
                        {config.continuous_mode ? "Continuous ∞" : "Single Batch"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Cooldown:</span>
                      <span className="text-white ml-2">{config.cooldown_minutes}m</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Email Check:</span>
                      <span className="text-white ml-2">{config.email_check_interval}s</span>
                    </div>
                  </div>
                  <Separator className="bg-slate-600" />
                  <div>
                    <span className="text-slate-400">Referral Code:</span>
                    <Badge className="ml-2 bg-blue-600">{config.referral_code}</Badge>
                  </div>
                  {config.continuous_mode && (
                    <div className="mt-2 p-2 bg-emerald-900/20 border border-emerald-500/20 rounded">
                      <p className="text-emerald-400 text-xs font-medium">
                        🚀 24/7 Mode: Will run indefinitely until manually stopped
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Live Logs */}
          <TabsContent value="logs">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-white flex items-center space-x-2">
                      <Activity className="h-5 w-5" />
                      <span>Live Activity Logs</span>
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Real-time automation progress and events
                    </CardDescription>
                  </div>
                  <Button onClick={clearLogs} variant="outline" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96 bg-slate-900/50 rounded-lg p-4">
                  {logs.length === 0 ? (
                    <p className="text-slate-500 text-center py-8">No logs available</p>
                  ) : (
                    <div className="space-y-2">
                      {logs.slice().reverse().map((log, index) => (
                        <div key={index} className="flex items-start space-x-3 text-sm">
                          <div className={`w-2 h-2 rounded-full mt-2 ${getLogLevelColor(log.level)}`} />
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="text-slate-400 text-xs">
                                {formatTimestamp(log.timestamp)}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {log.level}
                              </Badge>
                            </div>
                            <p className="text-slate-200 mt-1">{log.message}</p>
                            {log.account_data && (
                              <div className="mt-2 p-2 bg-slate-800/50 rounded text-xs">
                                <div className="text-slate-400">Account Details:</div>
                                <div className="text-slate-300 space-y-1">
                                  <div>Username: {log.account_data.username}</div>
                                  <div>Email: {log.account_data.email}</div>
                                  <div>Referral: {log.account_data.referral_code}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Configuration */}
          <TabsContent value="config">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Automation Configuration</span>
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Adjust automation parameters and settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-lg">
                        <div>
                          <Label className="text-slate-300 font-medium">
                            Continuous Mode
                          </Label>
                          <p className="text-xs text-slate-500 mt-1">
                            Run forever: 15 accounts → 15min wait → repeat
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Infinity className="h-4 w-4 text-emerald-400" />
                          <Switch
                            checked={config.continuous_mode}
                            onCheckedChange={(checked) => setConfig({...config, continuous_mode: checked})}
                            disabled={status.is_running}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="batch_size" className="text-slate-300">
                        Accounts per Batch
                      </Label>
                      <Input
                        id="batch_size"
                        type="number"
                        min="1"
                        max="50"
                        value={config.batch_size}
                        onChange={(e) => setConfig({...config, batch_size: parseInt(e.target.value)})}
                        className="bg-slate-700 border-slate-600 text-white"
                        disabled={status.is_running}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Number of accounts to create in each batch (1-50)
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="cooldown_minutes" className="text-slate-300">
                        Cooldown Period (minutes)
                      </Label>
                      <Input
                        id="cooldown_minutes"
                        type="number"
                        min="1"
                        max="120"
                        value={config.cooldown_minutes}
                        onChange={(e) => setConfig({...config, cooldown_minutes: parseInt(e.target.value)})}
                        className="bg-slate-700 border-slate-600 text-white"
                        disabled={status.is_running}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Wait time between batches {config.continuous_mode ? "(applies to continuous mode)" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email_check_interval" className="text-slate-300">
                        Email Check Interval (seconds)
                      </Label>
                      <Input
                        id="email_check_interval"
                        type="number"
                        min="5"
                        max="60"
                        value={config.email_check_interval}
                        onChange={(e) => setConfig({...config, email_check_interval: parseInt(e.target.value)})}
                        className="bg-slate-700 border-slate-600 text-white"
                        disabled={status.is_running}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        How often to check for verification emails
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="referral_code" className="text-slate-300">
                        Referral Code
                      </Label>
                      <Input
                        id="referral_code"
                        type="text"
                        value={config.referral_code}
                        onChange={(e) => setConfig({...config, referral_code: e.target.value})}
                        className="bg-slate-700 border-slate-600 text-white"
                        disabled={status.is_running}
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Referral code to use for all signups
                      </p>
                    </div>

                    <div className="bg-slate-700/50 p-4 rounded-lg">
                      <h4 className="text-white font-medium mb-2">
                        {config.continuous_mode ? "Continuous Operation" : "Single Batch"}
                      </h4>
                      {config.continuous_mode ? (
                        <div className="space-y-2">
                          <p className="text-emerald-400 font-bold text-lg">
                            ∞ Unlimited accounts
                          </p>
                          <p className="text-xs text-slate-500">
                            Runs forever: {config.batch_size} accounts → {config.cooldown_minutes}min wait → repeat
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-2xl font-bold text-emerald-400">
                            {config.batch_size} accounts
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Single batch execution
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <Alert className="bg-amber-500/10 border-amber-500/20">
                  <Mail className="h-4 w-4" />
                  <AlertDescription className="text-amber-200">
                    <strong>Important:</strong> Email verification is critical for referral counting. 
                    The system will automatically handle temporary email creation and verification link clicking.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <AutomationTool />
    </div>
  );
}

export default App;
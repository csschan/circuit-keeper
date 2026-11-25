// JobRegistry ABI — only the functions the keeper needs
const JOB_REGISTRY_ABI = [
  // Views
  "function nextJobId() external view returns (uint256)",
  "function checkUpkeep(uint256 jobId) external view returns (bool)",
  "function getJob(uint256 jobId) external view returns (tuple(address owner, address processor, uint256 circuitId, uint8 nIn, uint8 outputPin, address target, bytes callData, uint256 gasLimit, uint256 budget, uint256 feePerRun, uint256 cooldown, uint256 lastRun, bool active))",
  "function getActiveJobs() external view returns (uint256[])",

  // Execution
  "function executeJob(uint256 jobId) external",

  // Events
  "event JobExecuted(uint256 indexed jobId, address indexed keeper, uint256 timestamp)",
  "event JobRegistered(uint256 indexed jobId, address indexed owner, address processor, uint256 circuitId)",

  // Errors
  "error JobNotActive(uint256 jobId)",
  "error CooldownNotMet(uint256 jobId, uint256 readyAt)",
  "error InsufficientBudget(uint256 jobId)",
  "error ConditionNotMet(uint256 jobId)",
  "error TargetCallFailed(uint256 jobId)",
];

module.exports = { JOB_REGISTRY_ABI };

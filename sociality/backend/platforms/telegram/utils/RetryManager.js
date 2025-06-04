class RetryManager {
  constructor() {
    this.retryQueues = new Map();
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second
    this.maxDelay = 30000; // 30 seconds
  }

  async executeWithRetry(operation, operationId, context = {}) {
    const retryKey = `${operationId}_${Date.now()}`;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Remove from retry queue on success
        this.retryQueues.delete(retryKey);
        
        console.log(`Operation ${operationId} succeeded on attempt ${attempt}`);
        return result;
      } catch (error) {
        console.error(`Operation ${operationId} failed on attempt ${attempt}:`, error.message);
        
        if (attempt === this.maxRetries) {
          // Final failure
          this.retryQueues.set(retryKey, {
            operationId,
            context,
            attempts: attempt,
            lastError: error.message,
            status: 'failed',
            timestamp: new Date()
          });
          throw error;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(this.baseDelay * Math.pow(2, attempt - 1), this.maxDelay);
        
        // Update retry queue
        this.retryQueues.set(retryKey, {
          operationId,
          context,
          attempts: attempt,
          lastError: error.message,
          status: 'retrying',
          nextRetry: new Date(Date.now() + delay),
          timestamp: new Date()
        });
        
        console.log(`Retrying operation ${operationId} in ${delay}ms (attempt ${attempt + 1}/${this.maxRetries})`);
        await this.delay(delay);
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    const queues = Array.from(this.retryQueues.values());
    return {
      totalOperations: queues.length,
      retrying: queues.filter(q => q.status === 'retrying').length,
      failed: queues.filter(q => q.status === 'failed').length,
      operations: queues
    };
  }

  clearFailedOperations() {
    const failed = Array.from(this.retryQueues.entries())
      .filter(([_, operation]) => operation.status === 'failed');
    
    failed.forEach(([key, _]) => this.retryQueues.delete(key));
    
    return failed.length;
  }

  getFailedOperations() {
    return Array.from(this.retryQueues.values())
      .filter(operation => operation.status === 'failed');
  }

  getRetryingOperations() {
    return Array.from(this.retryQueues.values())
      .filter(operation => operation.status === 'retrying');
  }
}

module.exports = RetryManager;

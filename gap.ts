  const mapSeries = new Map<string, number[]>();
  for (const doc of spedData.documents) {
    if (doc.indOper === '1' && (doc.codMod === '55' || doc.codMod === '65')) {
      const key = `${doc.codMod}_${doc.serie}`;
      if (!mapSeries.has(key)) mapSeries.set(key, []);
      mapSeries.get(key)!.push(parseInt(doc.numDoc, 10));
    }
  }

  for (const [key, nums] of mapSeries.entries()) {
    if (nums.length === 0) continue;
    nums.sort((a, b) => a - b);
    let expected = nums[0];
    const max = nums[nums.length - 1];
    const missing = [];
    for (let i = 0; i < nums.length; i++) {
      if (nums[i] > expected) {
        for (let j = expected; j < nums[i]; j++) {
          missing.push(j);
        }
        expected = nums[i] + 1;
      } else if (nums[i] === expected) {
        expected++;
      }
    }
    
    // Create Achado for missing sequences
  }


import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { generateChannelsAndBets } from '../services/geminiService';
import { Campaign, OperatingPrinciple, Channel } from '../types';

export const useOnboarding = () => {
  const { setCampaign, updateCampaign, importAIPlan, campaign, addChannel, updateChannel, deleteChannel, setCurrentView } = useStore();
  
  // --- Core State ---
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  
  const [formData, setFormData] = useState<{
    quarter: string;
    objective: string;
    startDate: string;
    endDate: string;
    principles: OperatingPrinciple[];
  }>({
    quarter: campaign?.name || '',
    objective: campaign?.objective || '',
    startDate: campaign?.startDate || new Date().toISOString().split('T')[0],
    endDate: campaign?.endDate || new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString().split('T')[0],
    principles: campaign?.principles || []
  });

  // --- Synchronization ---
  useEffect(() => {
    if (campaign) {
      setFormData(prev => ({
        ...prev,
        quarter: campaign.name,
        objective: campaign.objective,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        principles: campaign.principles || []
      }));
    }
  }, [campaign]);

  // --- Actions ---

  const updateStore = (status: 'Onboarding' | 'Planning') => {
    const c: Campaign = {
      id: campaign?.id || crypto.randomUUID(),
      name: formData.quarter,
      objective: formData.objective,
      startDate: formData.startDate,
      endDate: formData.endDate,
      status: status,
      channels: campaign?.channels || [],
      principles: formData.principles,
      projects: campaign?.projects || [],
      docs: campaign?.docs || [],
      docFolders: campaign?.docFolders || []
    };
    if (campaign) {
      updateCampaign(c);
    } else {
      setCampaign(c);
    }
  };

  const handleNext = async () => {
    if (step === 1) {
      if (!formData.quarter || !formData.objective) return;
      updateStore('Onboarding');
      // Directly show Channel Setup instead of Principles step
      setShowChannelModal(true);
    } else if (step === 2) { // AI Strategy
      setLoading(true);
      const result = await generateChannelsAndBets(formData.objective);
      if (result && result.channels) {
        importAIPlan(result.channels);
      }
      setLoading(false);
      setStep(3); // Summary
    } else {
      updateStore('Planning');
      setCurrentView('CANVAS');
    }
  };

  const handleChannelSetupComplete = (channels: Partial<Channel>[]) => {
      if (campaign) {
          const existingIds = campaign.channels.map(c => c.id);
          const newIds = channels.map(c => c.id);

          // Delete removed
          existingIds.forEach(id => {
              if (!newIds.includes(id)) {
                  deleteChannel(id);
              }
          });

          // Add or Update
          channels.forEach(c => {
              if (existingIds.includes(c.id!)) {
                  updateChannel(c.id!, { name: c.name, tags: c.tags });
              } else {
                  addChannel({
                      id: c.id || crypto.randomUUID(),
                      name: c.name!,
                      campaignId: campaign.id,
                      tickets: [],
                      principles: [],
                      tags: c.tags || []
                  });
              }
          });
      }

      setShowChannelModal(false);
      setStep(2); // Go to AI Strategy
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  return {
    state: {
      step,
      loading,
      formData,
      campaign,
      showChannelModal
    },
    actions: {
      setStep,
      setFormData,
      handleNext,
      handleBack,
      handleChannelSetupComplete,
      setShowChannelModal
    }
  };
};

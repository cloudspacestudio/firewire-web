CREATE TABLE [dbo].[deviceSets](
    [deviceSetId] [nvarchar](40) NOT NULL,
    [name] [nvarchar](120) NOT NULL,
    [createat] [datetime] NOT NULL,
    [createby] [nvarchar](40) NOT NULL,
    [updateat] [datetime] NOT NULL,
    [updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_deviceSets] PRIMARY KEY CLUSTERED
(
    [deviceSetId] ASC
)
)
GO

ALTER TABLE [dbo].[deviceSets] ADD CONSTRAINT [DF_deviceSets_deviceSetId] DEFAULT (newid()) FOR [deviceSetId]
GO

ALTER TABLE [dbo].[deviceSets] ADD DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[deviceSets] ADD DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[deviceSets] ADD DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[deviceSets] ADD DEFAULT ('system') FOR [updateby]
GO

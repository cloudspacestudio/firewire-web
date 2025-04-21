USE [corp]
GO

/****** Object:  Table [dbo].[vendors]    Script Date: 4/15/2025 6:47:05 AM ******/
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[vendors](
	[vendorId] [nvarchar](40) NOT NULL,
	[name] [nvarchar](100) NOT NULL,
	[desc] [nvarchar](500) NULL,
	[link] [nvarchar](500) NULL,
	[createat] [date] NOT NULL,
	[createby] [nvarchar](40) NOT NULL,
	[updateat] [date] NOT NULL,
	[updateby] [nvarchar](40) NOT NULL,
 CONSTRAINT [PK_vendors] PRIMARY KEY CLUSTERED 
(
	[vendorId] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[vendors] ADD  CONSTRAINT [DF_vendors_vendorId]  DEFAULT (newid()) FOR [vendorId]
GO

ALTER TABLE [dbo].[vendors] ADD  DEFAULT (getdate()) FOR [createat]
GO

ALTER TABLE [dbo].[vendors] ADD  DEFAULT ('system') FOR [createby]
GO

ALTER TABLE [dbo].[vendors] ADD  DEFAULT (getdate()) FOR [updateat]
GO

ALTER TABLE [dbo].[vendors] ADD  DEFAULT ('system') FOR [updateby]
GO


module.exports = (sequelize, DataTypes) => {
  const Video = sequelize.define("Video", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    projectId: {
      type: DataTypes.UUID,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    name:       DataTypes.STRING,
    path:       DataTypes.STRING,
    size:       DataTypes.INTEGER,
    duration:   DataTypes.FLOAT,
    status: {
      type: DataTypes.STRING,
      defaultValue: 'uploaded',
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    previousVersionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    nextVersionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    isCurrent: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  });

  Video.associate = models => {
    Video.belongsTo(models.Video, { as: 'previousVersion', foreignKey: 'previousVersionId' });
    Video.belongsTo(models.Video, { as: 'nextVersion',     foreignKey: 'nextVersionId' });
    Video.belongsTo(models.User,  { foreignKey: 'userId' });
  };

  Video.beforeCreate(video => {
    if (!video.projectId) video.projectId = video.id;
  });

  return Video;
};
